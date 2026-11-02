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

    // no point stacking a second one on a Double Shot that's still waiting for its miss
    public canUse(g: Game): boolean { return super.canUse(g) && !g.isDoubleShotActive(); }

    // it has no target, so any square is fine
    public isValidTarget(b: Board, t: Coordinate): boolean { return true; }

    public apply(g: Game, b: Board, t: Coordinate): void
    {
        g.setDoubleShotActive(true);
        this.markUsed();
    }
}
