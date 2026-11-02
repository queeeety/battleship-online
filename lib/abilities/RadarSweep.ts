import { Ability } from "./Ability";
import type { Game } from "../controllers";
import { Coordinate } from "../entities/board";
import type { Board } from "../entities/board";

/**
 * Scans a 3x3 area and shows which unshot squares have a ship.
 * The target is the top left corner. Can't go past the edge of the board.
 */
export class RadarSweep extends Ability
{
    private static readonly AREA_SIZE = 3;

    private revealed: Coordinate[];

    constructor()
    {
        super("Radar Sweep", true);
        this.revealed = [];
    }

    // the whole area is on the board and at least one square in it hasn't been shot
    public isValidTarget(b: Board, t: Coordinate): boolean
    {
        const area = RadarSweep.areaFrom(t);
        return area.every(sq => sq.isWithinBounds(b.getWidth(), b.getHeight()))
            && area.some(sq => !b.hasBeenTargeted(sq));
    }

    public apply(g: Game, b: Board, t: Coordinate): void
    {
        this.revealed = b.scanArea(t, RadarSweep.AREA_SIZE);
        this.markUsed();
    }

    // ship squares the last scan found, for the scanning player only
    public getRevealed(): Coordinate[] { return this.revealed; }

    // the 9 squares a sweep from this corner covers, so the UI can mark the empty ones
    public static areaFrom(topLeft: Coordinate): Coordinate[]
    {
        const squares: Coordinate[] = [];
        for (let dy = 0; dy < RadarSweep.AREA_SIZE; dy++)
        {
            for (let dx = 0; dx < RadarSweep.AREA_SIZE; dx++)
            {
                squares.push(new Coordinate(topLeft.getX() + dx, topLeft.getY() + dy));
            }
        }
        return squares;
    }
}
