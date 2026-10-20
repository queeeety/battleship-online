import { LobbyStatus, GameType } from "./enums";
import { Game } from "./Game";
import { Player } from "./Player";

/**
 * A private room that two players join with a 6 character code.
 * Lives on the server since both clients share it.
 */
export class Lobby
{
    // no 0, O, 1, I or L so codes can be read out loud without mistakes
    private static readonly CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
    private static readonly CODE_LENGTH = 6;

    private code: string;
    private status: LobbyStatus;
    private createdAt: Date;
    private gameType: GameType;
    private players: Player[];
    private game: Game;

    constructor(code: string, gameType: GameType)
    {
        this.code = code;
        this.status = LobbyStatus.WAITING;
        this.createdAt = new Date();
        this.gameType = gameType;
        this.players = [];
        this.game = new Game(gameType);
    }

    public static generateCode(): string
    {
        let code = "";
        for (let i = 0; i < Lobby.CODE_LENGTH; i++)
        {
            code += Lobby.CODE_CHARS[Math.floor(Math.random() * Lobby.CODE_CHARS.length)];
        }
        return code;
    }

    public static findByCode(code: string): Lobby | null { return null; }

    public join(name: string): Player { throw new Error("not implemented"); }

    public isFull(): boolean { return this.players.length >= 2; }

    public isJoinable(): boolean { return this.status == LobbyStatus.WAITING && !this.isFull(); }

    public shareLink(): string { return "/game/" + this.code; }

    public reset(): void {}

    public abandon(): void { this.status = LobbyStatus.ABANDONED; }

    public getCode(): string { return this.code; }

    public getStatus(): LobbyStatus { return this.status; }

    public getGameType(): GameType { return this.gameType; }

    public getGame(): Game { return this.game; }
}
