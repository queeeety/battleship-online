import type { Game } from "../entities/game";
import type { Board, Coordinate } from "../entities/board";

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

    public canUse(g: Game): boolean { return false; }

    public abstract isValidTarget(b: Board, t: Coordinate): boolean;

    public abstract apply(g: Game, b: Board, t: Coordinate): Coordinate[];

    public getName(): string { return this.name; }

    public getUsesTurnShot(): boolean { return this.usesTurnShot; }
}


