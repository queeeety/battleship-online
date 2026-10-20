import { GameState, GameType, EndReason } from "./enums";
import { Coordinate } from "./Coordinate";
import { Player } from "./Player";
import { Shot } from "./Shot";
import { GameResult } from "./GameResult";
import { RematchRequest } from "./RematchRequest";

/**
 * Runs one match from placement to game over.
 * Handles turns, shots, abilities and the win check.
 * On the server this is the real one, in AI mode it runs in the browser.
 */
export class Game
{
    private id: string;
    private state: GameState;
    private gameType: GameType;
    private players: Player[];
    private shots: Shot[];
    private currentTurn: Player | null;
    private winner: Player | null;
    private turnStartedAt: Date | null;
    private endReason: EndReason | null;
    private finishedAt: Date | null;
    private doubleShotActive: boolean;
    private rematchRequest: RematchRequest | null;

    constructor(gameType: GameType)
    {
        this.id = crypto.randomUUID();
        this.state = GameState.PLACEMENT;
        this.gameType = gameType;
        this.players = [];
        this.shots = [];
        this.currentTurn = null;
        this.winner = null;
        this.turnStartedAt = null;
        this.endReason = null;
        this.finishedAt = null;
        this.doubleShotActive = false;
        this.rematchRequest = null;
    }

    public addPlayer(p: Player): boolean
    {
        if (this.players.length >= 2) return false;
        this.players.push(p);
        return true;
    }

    // picks the starting player at random once both are ready
    public beginBattle(): void {}

    public fireShot(shooter: Player, target: Coordinate): Shot { throw new Error("not implemented"); }

    public fireRandomShot(p: Player): Shot { throw new Error("not implemented"); }

    // limit depends on game type: Beginner 30s, Original 15s, Quick Fire 5s
    public isTurnExpired(): boolean { return false; }

    public switchTurn(): void {}

    // draws again if Reroute comes up and no ship can move
    public grantAbility(p: Player): void {}

    public applyAbility(p: Player, target: Coordinate): void {}

    public checkWinCondition(): boolean { return false; }

    public declareWinner(p: Player, r: EndReason): void {}

    public forfeit(p: Player): void {}

    public resultFor(p: Player): GameResult { throw new Error("not implemented"); }

    public getState(): GameState { return this.state; }

    public getCurrentTurn(): Player | null { return this.currentTurn; }

    public getShots(): Shot[] { return this.shots; }
}
