import type { Game } from "../controllers";
import type { Board, Coordinate } from "../entities/board";
import { GameState } from "../enums";

/**
 * A one-use power you get when one of your ships is sunk.
 * Base class for the four ability types. The server applies all of them.
 * To add a new ability, extend this and add it to registry.ts.
 */
export abstract class Ability
{
    private name: string;
    protected usesTurnShot: boolean;
    private used: boolean;

    constructor(name: string, usesTurnShot: boolean)
    {
        this.name = name;
        this.usesTurnShot = usesTurnShot;
        this.used = false;
    }

    // only during the battle, and only once
    public canUse(g: Game): boolean { return g.getState() === GameState.IN_PROGRESS && !this.used; }

    public abstract isValidTarget(b: Board, t: Coordinate): boolean;

    public abstract apply(g: Game, b: Board, t: Coordinate): void;

    // subclasses call this once apply has worked
    protected markUsed(): void { this.used = true; }

    public getName(): string { return this.name; }

    public getUsesTurnShot(): boolean { return this.usesTurnShot; }

    public isUsed(): boolean { return this.used; }
}
