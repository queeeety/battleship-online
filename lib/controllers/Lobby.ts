import { LobbyStatus } from "../enums";
import type { GameType } from "../enums";
import { Game } from "./Game";
import type { Player } from "../entities/players";
import { LOBBY_CODE_CHARS, LOBBY_CODE_LENGTH } from "../config";

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
    private gameType: GameType;
    private players: Player[];
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

    public static generateCode(): string { return ""; }

    public static findByCode(code: string): Lobby | null { return null; }

    public join(name: string): Player { throw new Error("not implemented"); }

    public isFull(): boolean { return false; }

    public isJoinable(): boolean { return false; }

    public shareLink(): string { return ""; }

    public reset(): void {}

    public abandon(): void {}

    public getCode(): string { return this.code; }

    public getStatus(): LobbyStatus { return this.status; }

    public getGameType(): GameType { return this.gameType; }

    public getGame(): Game { return this.game; }
}
