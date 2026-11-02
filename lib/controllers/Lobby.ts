import { LobbyStatus } from "../enums";
import type { GameType } from "../enums";
import { Game } from "./Game";
import { Board } from "../entities/board";
import { HumanPlayer } from "../entities/players";
import { LOBBY_CODE_CHARS, LOBBY_CODE_LENGTH, MAX_PLAYERS } from "../config";

/**
 * A private room that two players join with a 6 character code.
 * Lives on the server since both clients share it.
 * Knows nothing about the database: GameRepository saves it and rebuilds it on each request.
 */
export class Lobby
{
    private static readonly CODE_CHARS: string = LOBBY_CODE_CHARS;
    private static readonly CODE_LENGTH: number = LOBBY_CODE_LENGTH;

    private code: string;
    private status: LobbyStatus;
    private createdAt: Date;
    private gameType: GameType;
    private players: HumanPlayer[];
    private game: Game;

    constructor(gameType: GameType, code: string = Lobby.generateCode())
    {
        this.code = code;
        this.status = LobbyStatus.WAITING;
        this.createdAt = new Date();
        this.gameType = gameType;
        this.players = [];
        this.game = new Game(gameType);
    }

    /**
     * Rebuilds a lobby loaded from the database. Players are re-added to the game in seat order,
     * so seat 1 is always players[0].
     */
    public static restore(code: string, gameType: GameType, status: LobbyStatus, createdAt: Date, players: HumanPlayer[]): Lobby
    {
        const lobby = new Lobby(gameType, code);
        lobby.status = status;
        lobby.createdAt = createdAt;
        for (const p of players)
        {
            lobby.players.push(p);
            lobby.game.addPlayer(p);
        }
        return lobby;
    }

    /** 6 random characters from the unambiguous set. Server retries if the code is already taken. */
    public static generateCode(): string
    {
        const picks = crypto.getRandomValues(new Uint32Array(Lobby.CODE_LENGTH));
        return Array.from(picks, n => Lobby.CODE_CHARS[n % Lobby.CODE_CHARS.length]).join("");
    }

    /**
     * Not used: the server keeps no lobbies in memory between requests,
     * so a lobby is found with GameRepository.loadLobby(code) instead.
     */
    public static findByCode(code: string): Lobby | null
    {
        throw new Error(`Lobbies live in the database: use GameRepository.loadLobby("${code}")`);
    }

    /**
     * Seats a player: the first to join is the host (seat 1), the second is the guest (seat 2).
     * The second join fills the lobby and moves it to IN_PROGRESS, with the game in placement.
     */
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

    /** Open for a new player: still waiting and a seat is free. */
    public isJoinable(): boolean { return this.status === LobbyStatus.WAITING && !this.isFull(); }

    /** The path the host shares, matching the /game/[code] route. The browser adds its own origin. */
    public shareLink(): string { return `/game/${this.code}`; }

    /**
     * Rematch: same code, same two players, a fresh game in placement.
     * Each player gets an empty board and loses any held ability.
     */
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

    /** The code stops working; the cleanup job deletes the row later. */
    public abandon(): void { this.status = LobbyStatus.ABANDONED; }

    /** 1 or 2 if this session holds a seat, otherwise null. */
    public seatOf(sessionId: string): 1 | 2 | null
    {
        const index = this.players.findIndex(p => p.getSessionId() === sessionId);
        return index === 0 ? 1 : index === 1 ? 2 : null;
    }

    public getCode(): string { return this.code; }

    public getStatus(): LobbyStatus { return this.status; }

    public getGameType(): GameType { return this.gameType; }

    public getCreatedAt(): Date { return this.createdAt; }

    public getPlayers(): HumanPlayer[] { return this.players; }

    public getGame(): Game { return this.game; }
}
