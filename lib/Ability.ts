import { Game } from "./Game";
import { Board } from "./Board";
import { Coordinate } from "./Coordinate";

/**
 * A one-use power you get when one of your ships is sunk.
 * Base class for the four ability types. The server applies all of them.
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

    // own turn, before firing, not used yet
    public canUse(g: Game): boolean { return !this.used; }

    public abstract isValidTarget(b: Board, t: Coordinate): boolean;

    public abstract apply(g: Game, b: Board, t: Coordinate): void;

    public getName(): string { return this.name; }

    public getUsesTurnShot(): boolean { return this.usesTurnShot; }
}

