import { GameState, JoinError, LobbyStatus } from "../enums";
import type { EndReason, GameType, ShotResult } from "../enums";
import { Lobby } from "./Lobby";
import type { HumanPlayer } from "../entities/players";
import type { BoardSnapshot, Coordinate } from "../entities/board";
import type { Game } from "./Game";
import type { Shot, RematchRequest } from "../entities/game";
import type { Ability } from "../abilities";
import { GameRepository, MoveRefusedError, StaleGameError } from "../server/GameRepository";
import type { LoadedGame } from "../server/GameRepository";
import { InvalidRequestError, RequestValidator } from "../server/RequestValidator";
import { SessionManager } from "../server/SessionManager";
import { RateLimiter } from "../server/RateLimiter";

/** The caller has no seat in this game (or no session, or a malformed code). */
export class NotSeatedError extends Error
{
    constructor()
    {
        super("You're not seated in this game");
        this.name = "NotSeatedError";
    }
}

/** A shot as the screens see it. */
export interface ShotView
{
    row: number;
    col: number;
    result: ShotResult;
    sunkShipName: string | null;
}

/** What getMyState returns: only what this player is allowed to see. */
export interface PlayerView
{
    code: string;
    gameType: GameType;
    lobbyStatus: LobbyStatus;
    gameState: GameState | null;
    seat: 1 | 2;
    you: { name: string; ready: boolean; connected: boolean };
    opponent: { name: string; ready: boolean; connected: boolean } | null;
    yourTurn: boolean;
    turnStartedAt: string | null;
    doubleShotActive: boolean;
    yourBoard: BoardSnapshot;
    yourShots: ShotView[];
    opponentShots: ShotView[];
    heldAbility: string | null;
    offeredAbility: string | null;
    winner: 1 | 2 | null;
    endReason: EndReason | null;
    opponentBoard: BoardSnapshot | null;
    result: { won: boolean; shotsFired: number; accuracy: number; shipsSunk: number } | null;
}

/** A create or join refused with a JoinError the screen can show. */
export class JoinRefusedError extends Error
{
    public readonly reason: JoinError;

    constructor(reason: JoinError)
    {
        super(`Join refused: ${JoinError[reason]}`);
        this.name = "JoinRefusedError";
        this.reason = reason;
    }
}

export class RateLimitedError extends Error
{
    constructor()
    {
        super("Too many requests, try again in a moment");
        this.name = "RateLimitedError";
    }
}

/**
 * The single authority for lobbies and games.
 * Every client action goes through here so nobody can change the game directly.
 * Stateless - the lobby and game get loaded from the database on each request.
 */
export class Server
{
    private static readonly MAX_CODE_TRIES = 10;
    private static readonly MAX_SAVE_TRIES = 3;

    private repo: GameRepository;
    private validator: RequestValidator;
    private sessions: SessionManager;
    private limiter: RateLimiter;

    // app code uses create(); tests pass fakes
    constructor(sessions: SessionManager, repo: GameRepository = new GameRepository(), limiter: RateLimiter = new RateLimiter())
    {
        this.repo = repo;
        this.validator = new RequestValidator();
        this.sessions = sessions;
        this.limiter = limiter;
    }

    /** One Server per request, since the session belongs to one player. */
    public static async create(): Promise<Server>
    {
        return new Server(await SessionManager.create());
    }

    /** Seats the caller as host, signing them in first if they're new. */
    public async createLobby(name: unknown, type: unknown): Promise<Lobby>
    {
        const sessionId = await this.callerSessionId();
        await this.checkRateLimit(sessionId, "createLobby");

        const gameType = this.validator.parseGameType(type);
        const playerName = this.validName(name);

        // retry while the code is taken (sequence 5.1)
        let lobby: Lobby | null = null;
        for (let i = 0; i < Server.MAX_CODE_TRIES && lobby === null; i++)
        {
            const candidate = new Lobby(gameType);
            if (await this.repo.loadLobby(candidate.getCode()) === null) lobby = candidate;
        }
        if (lobby === null) throw new Error("Couldn't find a free lobby code");

        lobby.join(playerName, sessionId);
        await this.repo.saveLobby(lobby);
        return lobby;
    }

    /** Seats the caller as guest, refusing as in sequence 5.1. A caller already seated gets their seat back. */
    public async joinLobby(code: unknown, name: unknown): Promise<{ lobby: Lobby; player: HumanPlayer }>
    {
        const sessionId = await this.callerSessionId();
        await this.checkRateLimit(sessionId, "joinLobby");

        let lobbyCode: string;
        try
        {
            lobbyCode = this.validator.parseCode(code);
        }
        catch
        {
            throw new JoinRefusedError(JoinError.CODE_NOT_FOUND);
        }
        const playerName = this.validName(name);

        const lobby = await this.repo.loadLobby(lobbyCode);
        if (lobby === null || lobby.getStatus() === LobbyStatus.ABANDONED) throw new JoinRefusedError(JoinError.CODE_NOT_FOUND);

        const seat = lobby.seatOf(sessionId);
        if (seat !== null) return { lobby, player: lobby.getPlayers()[seat - 1] };

        if (lobby.getStatus() === LobbyStatus.FINISHED) throw new JoinRefusedError(JoinError.GAME_ALREADY_FINISHED);
        if (!lobby.isJoinable()) throw new JoinRefusedError(JoinError.LOBBY_FULL);

        const guest = lobby.join(playerName, sessionId);
        await this.repo.saveLobby(lobby);
        return { lobby, player: guest };
    }

    /**
     * Sets the caller's fleet and marks them ready. When both are ready, the battle starts
     * with a random first player. Retried if the other player saved at the same moment.
     */
    public async placeShips(code: unknown, layout: unknown): Promise<boolean>
    {
        const { lobbyCode, seat } = await this.seatedCaller(code);
        const board = this.validator.parseLayout(layout);

        return this.retryIfStale(lobbyCode, async () =>
        {
            const loaded = await this.loadStarted(lobbyCode);
            const player = loaded.game.getPlayers()[seat - 1];
            if (loaded.game.getState() !== GameState.PLACEMENT) throw new MoveRefusedError("Placement is over");

            player.placeFleet(board);
            player.confirmPlacement();
            if (loaded.game.getPlayers().every(p => p.getIsReady())) loaded.game.beginBattle();
            return await this.repo.saveGame(loaded.game, loaded.version) !== null;
        });
    }

    /**
     * Fires at the opponent. The rules decide the result; the save only goes through if
     * nothing changed since loading, so a double-click can't fire twice (StaleGameError).
     */
    public async fireShot(code: unknown, target: unknown): Promise<Shot>
    {
        const { lobbyCode, player } = await this.seatedCaller(code);
        const square = this.validator.parseCoordinate(target);
        return this.repo.runShotTransaction(lobbyCode, player, square);
    }

    public useAbility(code: string, a: Ability, target: Coordinate): void {}

    /** Ends the game with the caller as the loser. Does nothing if it's already over. */
    public async forfeit(code: unknown): Promise<void>
    {
        const { lobbyCode, seat } = await this.seatedCaller(code);
        await this.retryIfStale(lobbyCode, async () =>
        {
            const loaded = await this.loadStarted(lobbyCode);
            if (loaded.game.getState() === GameState.FINISHED) return true;
            loaded.game.forfeit(loaded.game.getPlayers()[seat - 1]);
            return await this.repo.saveGame(loaded.game, loaded.version) !== null;
        });
    }

    public requestRematch(code: string, accept: boolean): RematchRequest { throw new Error("not implemented"); }

    /**
     * Everything the caller may see: public state, their own board in full, and the opponent's
     * board as shots only. The opponent's fleet is revealed only once the game is finished.
     */
    public async getMyState(code: unknown): Promise<PlayerView>
    {
        const { lobby, seat } = await this.seatedCaller(code);
        const game = (await this.repo.loadGame(lobby.getCode()))?.game ?? null;
        return Server.viewFor(lobby, game, seat);
    }

    /** Gives a refreshed player their seat back, or null. Matched by cookie, never the browser's value, so seats can't be stolen. */
    public async restoreSeat(sessionId?: string): Promise<{ lobby: Lobby; player: HumanPlayer } | null>
    {
        const caller = await this.sessions.currentSessionId();
        if (caller === null) return null;
        if (sessionId !== undefined && sessionId !== caller) return null;

        const code = await this.repo.findActiveLobbyCode(caller);
        if (code === null) return null;

        const lobby = await this.repo.loadLobby(code);
        const seat = lobby?.seatOf(caller) ?? null;
        if (lobby === null || seat === null) return null;

        return { lobby, player: lobby.getPlayers()[seat - 1] };
    }

    public claimTimeout(code: string): void {}

    public chooseAbility(code: string, keep: boolean): void {}

    private assignRandomName(): string
    {
        return `Player${Math.floor(100 + Math.random() * 900)}`;
    }

    private async callerSessionId(): Promise<string>
    {
        return (await this.sessions.currentSessionId()) ?? (await this.sessions.signInAnonymously());
    }

    private async checkRateLimit(sessionId: string, action: string): Promise<void>
    {
        if (!(await this.limiter.allow(sessionId, action))) throw new RateLimitedError();
    }

    private validName(raw: unknown): string
    {
        try
        {
            return this.validator.parseName(raw) ?? this.assignRandomName();
        }
        catch (e)
        {
            if (e instanceof InvalidRequestError) throw new JoinRefusedError(JoinError.INVALID_NAME);
            throw e;
        }
    }

    /** The caller's lobby, seat and player, or NotSeatedError if they aren't in this game. */
    private async seatedCaller(code: unknown): Promise<{ lobbyCode: string; lobby: Lobby; seat: 1 | 2; player: HumanPlayer }>
    {
        const sessionId = await this.sessions.currentSessionId();
        let lobbyCode: string;
        try
        {
            lobbyCode = this.validator.parseCode(code);
        }
        catch
        {
            throw new NotSeatedError();
        }
        const lobby = sessionId === null ? null : await this.repo.loadLobby(lobbyCode);
        const seat = lobby && sessionId ? lobby.seatOf(sessionId) : null;
        if (!lobby || seat === null) throw new NotSeatedError();
        return { lobbyCode, lobby, seat, player: lobby.getPlayers()[seat - 1] };
    }

    private async loadStarted(code: string): Promise<LoadedGame>
    {
        const loaded = await this.repo.loadGame(code);
        if (!loaded) throw new MoveRefusedError("The game hasn't started yet");
        return loaded;
    }

    /** Re-runs a load-change-save step if another save got in first (fn returns false). */
    private async retryIfStale(code: string, fn: () => Promise<boolean>): Promise<true>
    {
        for (let i = 0; i < Server.MAX_SAVE_TRIES; i++)
        {
            if (await fn()) return true;
        }
        throw new StaleGameError(code);
    }

    private static viewFor(lobby: Lobby, game: Game | null, seat: 1 | 2): PlayerView
    {
        const seated = lobby.getPlayers();
        const you = seated[seat - 1];
        const them = seated[2 - seat] ?? null;
        const base = {
            code: lobby.getCode(),
            gameType: lobby.getGameType(),
            lobbyStatus: lobby.getStatus(),
            seat,
            you: { name: you.getName(), ready: you.getIsReady(), connected: you.isConnected() },
            opponent: them ? { name: them.getName(), ready: them.getIsReady(), connected: them.isConnected() } : null
        };
        if (!game)
        {
            return {
                ...base, gameState: null, yourTurn: false, turnStartedAt: null, doubleShotActive: false,
                yourBoard: { ships: [], shots: [] }, yourShots: [], opponentShots: [],
                heldAbility: null, offeredAbility: null, winner: null, endReason: null, opponentBoard: null, result: null
            };
        }

        const players = game.getPlayers();
        const me = players[seat - 1];
        const opponent = players[2 - seat];
        const finished = game.getState() === GameState.FINISHED;
        const shotsBy = (p: typeof me) => game.getShots()
            .filter(s => s.getShooter() === p)
            .map(s => ({ ...s.getCoordinate().toRowCol(), result: s.getResult(), sunkShipName: s.getSunkShipName() }));
        const winner = game.getWinner();
        const result = finished ? game.resultFor(me) : null;

        return {
            ...base,
            gameState: game.getState(),
            yourTurn: game.getCurrentTurn() === me,
            turnStartedAt: game.getTurnStartedAt()?.toISOString() ?? null,
            doubleShotActive: game.isDoubleShotActive(),
            yourBoard: me.getBoard().toSnapshot(),
            yourShots: shotsBy(me),
            opponentShots: shotsBy(opponent),
            heldAbility: me.getHeldAbility()?.getName() ?? null,
            offeredAbility: me.getOfferedAbility()?.getName() ?? null,
            winner: winner === null ? null : (players.indexOf(winner) + 1) as 1 | 2,
            endReason: game.getEndReason(),
            // only once it's over, so the result screen can reveal the layout
            opponentBoard: finished ? opponent.getBoard().toSnapshot() : null,
            result: result && {
                won: result.getDidWin(), shotsFired: result.getShotsFired(),
                accuracy: result.getAccuracy(), shipsSunk: result.getShipsSunk()
            }
        };
    }
}
