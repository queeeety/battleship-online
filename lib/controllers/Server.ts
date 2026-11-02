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

/**
 * Thrown when a player can't create or join a lobby. `reason` is the JoinError
 * the screens show (code not found, lobby full, game finished, invalid name).
 */
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

/** Thrown when a player sends requests faster than the rate limit allows. */
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
    // tries at a unique lobby code before giving up; a clash is already about 1 in 900 million
    private static readonly MAX_CODE_TRIES = 10;

    private repo: GameRepository;
    private validator: RequestValidator;
    private sessions: SessionManager;
    private limiter: RateLimiter;

    /** App code uses Server.create(). Tests pass in fakes for the database and the rate limit. */
    constructor(sessions: SessionManager, repo: GameRepository = new GameRepository(), limiter: RateLimiter = new RateLimiter())
    {
        this.repo = repo;
        this.validator = new RequestValidator();
        this.sessions = sessions;
        this.limiter = limiter;
    }

    /** Builds a Server for the current request. Each request gets its own, because the session belongs to one player. */
    public static async create(): Promise<Server>
    {
        return new Server(await SessionManager.create());
    }

    /**
     * Creates a lobby and seats the caller as the host (seat 1).
     * A blank name gets a random one; a name over 16 characters is refused with INVALID_NAME.
     * Signs the caller in anonymously first if this is their first visit.
     */
    public async createLobby(name: unknown, type: unknown): Promise<Lobby>
    {
        const sessionId = await this.callerSessionId();
        await this.checkRateLimit(sessionId, "createLobby");

        const gameType = this.validator.parseGameType(type);
        const playerName = this.validName(name);

        // loop while the code is already in use (sequence diagram 5.1)
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

    /**
     * Seats the caller as the guest (seat 2), which starts placement for both players.
     * Refusals follow sequence diagram 5.1: CODE_NOT_FOUND, LOBBY_FULL, GAME_ALREADY_FINISHED, INVALID_NAME.
     * If the caller already holds a seat in this lobby (e.g. the host opened their own link),
     * they get that seat back instead of an error.
     * Returns the lobby too, so the caller knows the code and seat to show.
     */
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
            // a malformed code can't belong to any lobby
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

    /**
     * After a refresh: finds the game the caller is still seated in and gives them their seat back.
     * The seat is matched by the session cookie, never by a value the browser sends, so nobody
     * can take another player's place. If `sessionId` is passed, it must match the cookie.
     * Returns null if the caller isn't seated in any active game.
     */
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

    /** "Player" plus three digits, e.g. "Player482", for players who leave the name blank. */
    private assignRandomName(): string
    {
        return `Player${Math.floor(100 + Math.random() * 900)}`;
    }

    /** The caller's sessionId, signing them in anonymously if this is their first request. */
    private async callerSessionId(): Promise<string>
    {
        return (await this.sessions.currentSessionId()) ?? (await this.sessions.signInAnonymously());
    }

    private async checkRateLimit(sessionId: string, action: string): Promise<void>
    {
        if (!(await this.limiter.allow(sessionId, action))) throw new RateLimitedError();
    }

    /** The trimmed name, a random one if blank, or INVALID_NAME if it's too long. */
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
