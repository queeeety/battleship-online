import { Ability } from "./Ability";
import type { Game } from "../controllers";
import type { Board, Coordinate } from "../entities/board";
import type { Ship } from "../entities/ships";
import { Orientation } from "../enums";

/**
 * Moves one undamaged ship to a new spot.
 * The new spot can't cover any square the opponent already fired at.
 */
export class Reroute extends Ability
{
    private ship: Ship | null;
    private orientation: Orientation;

    constructor()
    {
        super("Reroute", true);
        this.ship = null;
        this.orientation = Orientation.HORIZONTAL;
    }

    public selectShip(s: Ship): void { this.ship = s; }

    public setOrientation(o: Orientation): void { this.orientation = o; }

    public isValidTarget(b: Board, t: Coordinate): boolean { return false; }

    public apply(g: Game, b: Board, t: Coordinate): void {}

    public validPositions(b: Board, s: Ship): Coordinate[] { return []; }
}

