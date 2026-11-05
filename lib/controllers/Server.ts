import { EndReason, GameState, JoinError, LobbyStatus, Orientation, RematchStatus, ShotResult } from "../enums";
import type { GameType } from "../enums";
import { Lobby } from "./Lobby";
import type { HumanPlayer, Player } from "../entities/players";
import { Coordinate } from "../entities/board";
import type { BoardSnapshot } from "../entities/board";
import type { Game } from "./Game";
import type { Shot, RematchRequest } from "../entities/game";
import { LineScan, RadarSweep, Reroute } from "../abilities";
import type { NetworkHandler, PrivatePayload } from "../boundary/NetworkHandler";
import { EMPTY_SCAN_LOG, GameRepository, MoveRefusedError, StaleGameError } from "../server/GameRepository";
import type { LoadedGame, ScanLog } from "../server/GameRepository";
import { InvalidRequestError, RequestValidator } from "../server/RequestValidator";
import type { AbilityRequest } from "../server/RequestValidator";
import { SessionManager } from "../server/SessionManager";
import { RateLimiter } from "../server/RateLimiter";

/** The caller has no seat in this game. */
export class NotSeatedError extends Error
{
    constructor()
    {
        super("You're not seated in this game");
        this.name = "NotSeatedError";
    }
}

export interface ShotView
{
    row: number;
    col: number;
    result: ShotResult;
    sunkShipName: string | null;
}

export interface SeatView
{
    name: string;
    ready: boolean;
    connected: boolean;
    disconnectedAt: string | null;
}

/** getMyState's result: only what this player may see. */
export interface PlayerView
{
    code: string;
    gameType: GameType;
    lobbyStatus: LobbyStatus;
    gameState: GameState | null;
    seat: 1 | 2;
    you: SeatView;
    opponent: SeatView | null;
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
    // the opponent's ships you've sunk, where they lay
    opponentSunkShips: BoardSnapshot["ships"];
    // your scans' unshot ship squares
    revealedSquares: { row: number; col: number }[];
    rematch: { by: 1 | 2; status: RematchStatus } | null;
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
    private notifier: Pick<NetworkHandler, "sendPrivate"> | null;

    // app code uses create(); tests pass fakes
    constructor(sessions: SessionManager, repo: GameRepository = new GameRepository(), limiter: RateLimiter = new RateLimiter(),
        notifier: Pick<NetworkHandler, "sendPrivate"> | null = null)
    {
        this.repo = repo;
        this.validator = new RequestValidator();
        this.sessions = sessions;
        this.limiter = limiter;
        this.notifier = notifier;
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

        if (lobby.isHostGone())
        {
            lobby.abandon();
            await this.repo.saveLobby(lobby);
            throw new JoinRefusedError(JoinError.CODE_NOT_FOUND);
        }

        if (lobby.getStatus() === LobbyStatus.FINISHED) throw new JoinRefusedError(JoinError.GAME_ALREADY_FINISHED);
        if (!lobby.isJoinable()) throw new JoinRefusedError(JoinError.LOBBY_FULL);

        const guest = lobby.join(playerName, sessionId);
        // two guests at once: only the first gets seat 2
        if (!(await this.repo.seatGuest(lobby))) throw new JoinRefusedError(JoinError.LOBBY_FULL);
        return { lobby, player: guest };
    }

    /** Places the fleet; the battle starts when both are ready. Retried on a clash. */
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

    /** Not retried, so a double-click fires once. */
    public async fireShot(code: unknown, target: unknown): Promise<Shot>
    {
        const { lobbyCode, player } = await this.seatedCaller(code);
        const square = this.validator.parseCoordinate(target);
        const shot = await this.repo.runShotTransaction(lobbyCode, player, square, g => Server.fireIfTurnExpired(g));

        // a sink can leave the owner a keep-or-replace offer
        if (shot.getResult() === ShotResult.SUNK)
        {
            const game = (await this.repo.loadGame(lobbyCode))?.game;
            const sunkOwner = game?.getPlayers().find(p => p.getId() !== player.getId());
            const current = sunkOwner?.getHeldAbility();
            const drawn = sunkOwner?.getOfferedAbility();
            if (sunkOwner && current && drawn) await this.notify(lobbyCode, sunkOwner, { kind: "abilityOffer", current, drawn });
        }
        return shot;
    }

    /** Not retried. Scan results reach the caller only. */
    public async useAbility(code: unknown, ability: unknown, target?: unknown): Promise<void>
    {
        const { lobbyCode, seat } = await this.seatedCaller(code);
        const request = this.validator.parseAbilityRequest(ability);
        // Double Shot has no target
        const square = request.name === "Double Shot" && target == null ? Coordinate.fromRowCol(0, 0) : this.validator.parseCoordinate(target);

        const loaded = await this.loadStarted(lobbyCode);
        const { game, version } = loaded;
        const scanLog: ScanLog = structuredClone(loaded.scanLog);
        const me = game.getPlayers()[seat - 1];
        const held = me.getHeldAbility();

        const changed = Server.fireIfTurnExpired(game);
        let revealed: Coordinate[];
        try
        {
            revealed = Server.applyRequested(game, me, seat, request, square, scanLog);
        }
        catch (e)
        {
            if (changed) await this.repo.saveGame(game, version);
            if (e instanceof MoveRefusedError) throw e;
            throw new MoveRefusedError(e instanceof Error ? e.message : "Ability refused");
        }
        if (await this.repo.saveGame(game, version, lobbyCode, scanLog) === null) throw new StaleGameError(lobbyCode);

        if (held instanceof RadarSweep || held instanceof LineScan) await this.notify(lobbyCode, me, { kind: "scanResult", cells: revealed });
        if (held) await this.notify(lobbyCode, game.opponentOf(me), { kind: "abilityUsed", by: me.getName(), ability: held });
    }

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

    /** true asks or accepts; false declines and closes the lobby. */
    public async requestRematch(code: unknown, accept: unknown): Promise<RematchRequest>
    {
        const { lobbyCode, lobby, seat } = await this.seatedCaller(code);
        const yes = this.validator.parseAnswer(accept);
        let answer: RematchRequest | null = null;

        await this.retryIfStale(lobbyCode, async () =>
        {
            const { game, version, rematch } = await this.loadStarted(lobbyCode);
            if (game.getState() !== GameState.FINISHED) throw new MoveRefusedError("The game isn't over yet");
            const me = game.getPlayers()[seat - 1];
            answer = rematch;
            if (rematch && rematch.getStatus() !== RematchStatus.REQUESTED) return true;

            if (!yes)
            {
                answer = rematch ?? me.requestRematch();
                answer.decline();
                return await this.repo.saveRematch(game, version, answer, true) !== null;
            }
            if (rematch?.getRequestedBy() === me) return true;
            if (!rematch)
            {
                answer = me.requestRematch();
                return await this.repo.saveRematch(game, version, answer) !== null;
            }

            rematch.accept();
            lobby.reset();
            for (const p of lobby.getPlayers()) p.reconnect();
            return await this.repo.saveGame(lobby.getGame(), version, lobbyCode, EMPTY_SCAN_LOG) !== null;
        });
        return answer!;
    }

    /** Also marks the caller as back. */
    public async getMyState(code: unknown): Promise<PlayerView>
    {
        const { lobbyCode, lobby, seat } = await this.seatedCaller(code);
        const loaded = await this.repo.loadGame(lobbyCode);
        let game = loaded?.game ?? null;
        if (game && !(game.getPlayers()[seat - 1] as HumanPlayer).isConnected()) game = await this.markBack(lobbyCode, seat);
        return Server.viewFor(lobby, game, seat, loaded?.rematch ?? null, loaded?.scanLog[seat === 1 ? "p1" : "p2"] ?? []);
    }

    /** A false report is undone by that player's next getMyState. */
    public async reportDisconnect(code: unknown): Promise<void>
    {
        const { lobbyCode, seat, player } = await this.seatedCaller(code);
        await this.checkRateLimit(player.getSessionId(), "reportDisconnect");

        await this.retryIfStale(lobbyCode, async () =>
        {
            const loaded = await this.repo.loadGame(lobbyCode);
            if (!loaded || loaded.game.getState() === GameState.FINISHED) return true;
            const them = loaded.game.getPlayers()[2 - seat] as HumanPlayer;
            if (!them.isConnected()) return true; // keep the first time, or the clock restarts
            them.disconnect();
            return await this.repo.saveGame(loaded.game, loaded.version) !== null;
        });
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

    /** False means not yet. */
    public async claimTimeout(code: unknown): Promise<boolean>
    {
        const { lobbyCode, seat } = await this.seatedCaller(code);
        let claimed = false;

        await this.retryIfStale(lobbyCode, async () =>
        {
            claimed = false;
            const loaded = await this.repo.loadGame(lobbyCode);
            if (!loaded || loaded.game.getState() === GameState.FINISHED) return true;
            const game = loaded.game;
            const me = game.getPlayers()[seat - 1] as HumanPlayer;
            const them = game.opponentOf(me) as HumanPlayer;

            if (them.hasExceededGracePeriod())
            {
                me.reconnect();
                game.declareWinner(me, EndReason.OPPONENT_DISCONNECTED);
                claimed = true;
            }
            else
            {
                claimed = Server.fireIfTurnExpired(game);
            }
            if (!claimed) return true;
            return await this.repo.saveGame(game, loaded.version) !== null;
        });
        return claimed;
    }

    /** true keeps the held ability, false takes the new draw. */
    public async chooseAbility(code: unknown, keep: unknown): Promise<void>
    {
        const { lobbyCode, seat } = await this.seatedCaller(code);
        const yes = this.validator.parseAnswer(keep);

        await this.retryIfStale(lobbyCode, async () =>
        {
            const { game, version } = await this.loadStarted(lobbyCode);
            const me = game.getPlayers()[seat - 1];
            if (!me.getOfferedAbility()) return true;   // nothing to answer, or already answered
            me.resolveOffer(yes);
            return await this.repo.saveGame(game, version) !== null;
        });
    }

    public async keepLobbyOpen(code: unknown): Promise<boolean>
    {
        const { lobbyCode } = await this.seatedCaller(code);
        return this.repo.keepLobbyOpen(lobbyCode);
    }

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

    private static applyRequested(game: Game, me: Player, seat: 1 | 2, request: AbilityRequest, square: Coordinate, scanLog: ScanLog): Coordinate[]
    {
        // using it before answering keeps it
        if (me.getOfferedAbility()) me.resolveOffer(true);

        const held = me.getHeldAbility();
        if (!held || held.getName() !== request.name) throw new MoveRefusedError(`You don't hold ${request.name}`);

        let movedFrom: Coordinate[] = [];
        if (held instanceof LineScan && request.name === "Line Scan") held.setDirection(request.line === "row");
        if (held instanceof Reroute && request.name === "Reroute")
        {
            const ship = me.getBoard().getShips().find(s => s.getName() === request.ship);
            if (!ship) throw new MoveRefusedError(`You have no ${request.ship}`);
            held.selectShip(ship);
            held.setOrientation(request.orientation === "horizontal" ? Orientation.HORIZONTAL : Orientation.VERTICAL);
            movedFrom = ship.getCoordinates();
        }

        game.applyAbility(me, square);

        const revealed = held instanceof RadarSweep || held instanceof LineScan ? held.getRevealed() : [];
        const mine = seat === 1 ? "p1" : "p2";
        const theirs = seat === 1 ? "p2" : "p1";
        const same = (a: { row: number; col: number }, b: Coordinate) => a.row === b.toRowCol().row && a.col === b.toRowCol().col;
        for (const c of revealed)
        {
            if (!scanLog[mine].some(s => same(s, c))) scanLog[mine].push(c.toRowCol());
        }
        // no highlight left on a rerouted ship's old squares
        scanLog[theirs] = scanLog[theirs].filter(s => !movedFrom.some(c => same(s, c)));
        return revealed;
    }

    // best effort: getMyState recovers anything lost
    private async notify(code: string, p: Player, payload: PrivatePayload): Promise<void>
    {
        try
        {
            if (!this.notifier)
            {
                const { NetworkHandler } = await import("../boundary/NetworkHandler");
                const { createAdminSupabase } = await import("../supabase/admin");
                this.notifier = new NetworkHandler(createAdminSupabase());
            }
            await this.notifier.sendPrivate(p as HumanPlayer, payload, code);
        }
        catch (e)
        {
            console.error("Private message failed", e);
        }
    }

    // paused while the player to move is away
    private static fireIfTurnExpired(game: Game): boolean
    {
        const current = game.getCurrentTurn() as HumanPlayer | null;
        if (!current || !current.isConnected() || !game.isTurnExpired()) return false;
        game.fireRandomShot(current);
        return true;
    }

    // clears the disconnect and gives back lost turn time
    private async markBack(code: string, seat: 1 | 2): Promise<Game>
    {
        let game: Game | null = null;
        await this.retryIfStale(code, async () =>
        {
            const loaded = await this.loadStarted(code);
            game = loaded.game;
            const me = game.getPlayers()[seat - 1] as HumanPlayer;
            const awaySince = me.getDisconnectedAt();
            if (me.isConnected() || awaySince === null) return true;

            const turnStart = game.getTurnStartedAt();
            if (game.getState() === GameState.IN_PROGRESS && game.getCurrentTurn() === me && turnStart)
            {
                game.resumeTurnTimer(Date.now() - Math.max(awaySince.getTime(), turnStart.getTime()));
            }
            me.reconnect();
            return await this.repo.saveGame(game, loaded.version) !== null;
        });
        return game!;
    }

    private async loadStarted(code: string): Promise<LoadedGame>
    {
        const loaded = await this.repo.loadGame(code);
        if (!loaded) throw new MoveRefusedError("The game hasn't started yet");
        return loaded;
    }

    // fn returns false when another save got in first
    private async retryIfStale(code: string, fn: () => Promise<boolean>): Promise<true>
    {
        for (let i = 0; i < Server.MAX_SAVE_TRIES; i++)
        {
            if (await fn()) return true;
        }
        throw new StaleGameError(code);
    }

    private static viewFor(lobby: Lobby, game: Game | null, seat: 1 | 2, rematch: RematchRequest | null = null,
        scanned: { row: number; col: number }[] = []): PlayerView
    {
        // the game's copy is newer once started
        const seated = (game?.getPlayers() as HumanPlayer[] | undefined) ?? lobby.getPlayers();
        const seatView = (p: HumanPlayer): SeatView => ({
            name: p.getName(), ready: p.getIsReady(), connected: p.isConnected(),
            disconnectedAt: p.getDisconnectedAt()?.toISOString() ?? null
        });
        const them = seated[2 - seat];
        const base = {
            code: lobby.getCode(),
            gameType: lobby.getGameType(),
            lobbyStatus: lobby.getStatus(),
            seat,
            you: seatView(seated[seat - 1]),
            opponent: them ? seatView(them) : null
        };
        if (!game)
        {
            return {
                ...base, gameState: null, yourTurn: false, turnStartedAt: null, doubleShotActive: false,
                yourBoard: { ships: [], shots: [] }, yourShots: [], opponentShots: [],
                heldAbility: null, offeredAbility: null, winner: null, endReason: null, opponentBoard: null, opponentSunkShips: [],
                revealedSquares: [], rematch: null, result: null
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
        const sunkNames = new Set(opponent.getBoard().getShips().filter(s => s.isSunk()).map(s => s.getName()));

        return {
            ...base,
            gameState: game.getState(),
            yourTurn: !finished && game.getCurrentTurn() === me,
            turnStartedAt: game.getTurnStartedAt()?.toISOString() ?? null,
            doubleShotActive: game.isDoubleShotActive(),
            yourBoard: me.getBoard().toSnapshot(),
            yourShots: shotsBy(me),
            opponentShots: shotsBy(opponent),
            heldAbility: me.getHeldAbility()?.getName() ?? null,
            offeredAbility: me.getOfferedAbility()?.getName() ?? null,
            winner: winner === null ? null : (players.indexOf(winner) + 1) as 1 | 2,
            endReason: game.getEndReason(),
            opponentBoard: finished ? opponent.getBoard().toSnapshot() : null,
            opponentSunkShips: opponent.getBoard().toSnapshot().ships.filter(s => sunkNames.has(s.name)),
            revealedSquares: finished ? [] : scanned.filter(s => !opponent.getBoard().hasBeenTargeted(Coordinate.fromRowCol(s.row, s.col))),
            rematch: rematch && {
                by: (players.findIndex(p => p.getId() === rematch.getRequestedBy().getId()) + 1) as 1 | 2,
                status: rematch.getStatus()
            },
            result: result && {
                won: result.getDidWin(), shotsFired: result.getShotsFired(),
                accuracy: result.getAccuracy(), shipsSunk: result.getShipsSunk()
            }
        };
    }
}
