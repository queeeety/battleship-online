import { JoinError, LobbyStatus } from "../enums";
import type { GameType } from "../enums";
import { Lobby } from "./Lobby";
import type { HumanPlayer } from "../entities/players";
import type { Board, Coordinate } from "../entities/board";
import type { Game } from "./Game";
import type { Shot, RematchRequest } from "../entities/game";
import type { Ability } from "../abilities";
import { GameRepository } from "../server/GameRepository";
import { InvalidRequestError, RequestValidator } from "../server/RequestValidator";
import { SessionManager } from "../server/SessionManager";
import { RateLimiter } from "../server/RateLimiter";

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

    public placeShips(code: string, layout: Board): boolean { return false; }

    public fireShot(code: string, target: Coordinate): Shot { throw new Error("not implemented"); }

    public useAbility(code: string, a: Ability, target: Coordinate): void {}

    public forfeit(code: string): void {}

    public requestRematch(code: string, accept: boolean): RematchRequest { throw new Error("not implemented"); }

    public getMyState(code: string): Game { throw new Error("not implemented"); }

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
}
