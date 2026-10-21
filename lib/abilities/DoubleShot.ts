import { Ability } from "./Ability";
import type { Game } from "../controllers";
import type { Board, Coordinate } from "../entities/board";

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

    public isValidTarget(b: Board, t: Coordinate): boolean { return false; }

    public apply(g: Game, b: Board, t: Coordinate): void {}
}


