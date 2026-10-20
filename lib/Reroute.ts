import { Ability } from "./Ability";
import { Game } from "./Game";
import { Board } from "./Board";
import { Ship } from "./Ship";
import { Coordinate } from "./Coordinate";
import { Orientation } from "./enums";

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

    // empty list means Game has to draw a different ability
    public validPositions(b: Board, s: Ship): Coordinate[] { return []; }
}
