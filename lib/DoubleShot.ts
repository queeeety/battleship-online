import { Ability } from "./Ability";
import { Game } from "./Game";
import { Board } from "./Board";
import { Coordinate } from "./Coordinate";

/**
 * Your next miss this turn doesn't end the turn.
 * Doesn't use up the shot so you still fire after.
 */
export class DoubleShot extends Ability
{
    constructor()
    {
        super("Double Shot", false);
    }

    // no target needed
    public isValidTarget(b: Board, t: Coordinate): boolean { return true; }

    public apply(g: Game, b: Board, t: Coordinate): void {}
}
