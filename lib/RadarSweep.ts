import { Ability } from "./Ability";
import { Game } from "./Game";
import { Board } from "./Board";
import { Coordinate } from "./Coordinate";

/**
 * Scans a 3x3 area and shows which unshot squares have a ship.
 * The target is the top left corner. Can't go past the edge of the board.
 */
export class RadarSweep extends Ability
{
    private static readonly AREA_SIZE = 3;

    constructor()
    {
        super("Radar Sweep", true);
    }

    public isValidTarget(b: Board, t: Coordinate): boolean { return false; }

    public apply(g: Game, b: Board, t: Coordinate): void {}
}
