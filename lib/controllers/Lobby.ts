import { LobbyStatus } from "../enums";
import type { GameType } from "../enums";
import { Game } from "./Game";
import { Board } from "../entities/board";
import { HumanPlayer } from "../entities/players";
import { HOST_GONE_MS, LOBBY_CODE_CHARS, LOBBY_CODE_LENGTH, MAX_PLAYERS } from "../config";

/**
 * A private room that two players join with a 6 character code.
 * Lives on the server since both clients share it.
 */
export class Lobby
{
    private static readonly CODE_CHARS: string = LOBBY_CODE_CHARS;
    private static readonly CODE_LENGTH: number = LOBBY_CODE_LENGTH;

    private code: string;
    private status: LobbyStatus;
    private createdAt: Date;
    private lastSeenAt: Date;
    private gameType: GameType;
    private players: HumanPlayer[];
    private game: Game;

    constructor(gameType: GameType, code: string = Lobby.generateCode())
    {
        this.code = code;
        this.status = LobbyStatus.WAITING;
        this.createdAt = new Date();
        this.lastSeenAt = this.createdAt;
        this.gameType = gameType;
        this.players = [];
        this.game = new Game(gameType);
    }

    /** Rebuilds a lobby from the database. Players must be in seat order. */
    public static restore(code: string, gameType: GameType, status: LobbyStatus, createdAt: Date, players: HumanPlayer[], lastSeenAt: Date = createdAt): Lobby
    {
        const lobby = new Lobby(gameType, code);
        lobby.status = status;
        lobby.createdAt = createdAt;
        lobby.lastSeenAt = lastSeenAt;
        for (const p of players)
        {
            lobby.players.push(p);
            lobby.game.addPlayer(p);
        }
        return lobby;
    }

    public static generateCode(): string
    {
        const picks = crypto.getRandomValues(new Uint32Array(Lobby.CODE_LENGTH));
        return Array.from(picks, n => Lobby.CODE_CHARS[n % Lobby.CODE_CHARS.length]).join("");
    }

    /** Unused: the server is stateless, so use GameRepository.loadLobby. */
    public static findByCode(code: string): Lobby | null
    {
        throw new Error(`Lobbies live in the database: use GameRepository.loadLobby("${code}")`);
    }

    /** First join is the host (seat 1); the second fills the lobby and starts placement. */
    public join(name: string, sessionId: string): HumanPlayer
    {
        if (!this.isJoinable()) throw new Error("This lobby can't be joined");
        if (this.seatOf(sessionId) !== null) throw new Error("This session already has a seat in the lobby");

        const player = new HumanPlayer(name, sessionId);
        this.players.push(player);
        this.game.addPlayer(player);

        if (this.isFull()) this.status = LobbyStatus.IN_PROGRESS;
        return player;
    }

    public isFull(): boolean { return this.players.length >= MAX_PLAYERS; }

    public isJoinable(): boolean { return this.status === LobbyStatus.WAITING && !this.isFull(); }

    public shareLink(): string { return `/game/${this.code}`; }

    /** Rematch: same code and players, fresh game and boards. */
    public reset(): void
    {
        this.game = new Game(this.gameType);
        for (const p of this.players)
        {
            p.placeFleet(new Board());
            p.clearAbilities();
            this.game.addPlayer(p);
        }
        this.status = LobbyStatus.IN_PROGRESS;
    }

    public abandon(): void { this.status = LobbyStatus.ABANDONED; }

    // a refresh stays well under the 30 s
    public isHostGone(now: Date = new Date()): boolean
    {
        return this.status === LobbyStatus.WAITING && now.getTime() - this.lastSeenAt.getTime() > HOST_GONE_MS;
    }

    public seatOf(sessionId: string): 1 | 2 | null
    {
        const index = this.players.findIndex(p => p.getSessionId() === sessionId);
        return index === 0 ? 1 : index === 1 ? 2 : null;
    }

    public getCode(): string { return this.code; }

    public getStatus(): LobbyStatus { return this.status; }

    public getGameType(): GameType { return this.gameType; }

    public getCreatedAt(): Date { return this.createdAt; }

    public getLastSeenAt(): Date { return this.lastSeenAt; }

    public getPlayers(): HumanPlayer[] { return this.players; }

    public getGame(): Game { return this.game; }
}
