import { Ability } from "./Ability";
import type { Game } from "../controllers";
import { Coordinate } from "../entities/board";
import type { Board } from "../entities/board";
import { Ship } from "../entities/ships";
import { Orientation } from "../enums";

/**
 * Moves one undamaged ship to a new spot.
 * The new spot can't cover any square the opponent already fired at,
 * or an old miss would end up with a ship under it.
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

    public getShip(): Ship | null { return this.ship; }

    public getOrientation(): Orientation { return this.orientation; }

    // the selected ship can move so its start lands on t, in the chosen orientation
    public isValidTarget(b: Board, t: Coordinate): boolean
    {
        if (!this.ship) return false;
        return this.validPositions(b, this.ship).some(start => start.equals(t));
    }

    public apply(g: Game, b: Board, t: Coordinate): void
    {
        if (!this.ship || !b.moveShip(this.ship, t, this.orientation))
        {
            throw new Error(`Can't reroute to ${t.key()}`);
        }
        this.markUsed();
    }

    // every start square the ship could move to in orientation o (the chosen one by default).
    // It may overlap its own old squares, but must keep clear of other ships and of squares
    // that have been fired at.
    // Its current spot doesn't count, that isn't a move.
    public validPositions(b: Board, s: Ship, o: Orientation = this.orientation): Coordinate[]
    {
        if (!b.getShips().includes(s) || s.isDamaged()) return [];

        const current = s.getStart();
        const positions: Coordinate[] = [];
        for (let y = 0; y < b.getHeight(); y++)
        {
            for (let x = 0; x < b.getWidth(); x++)
            {
                const start = new Coordinate(x, y);
                if (current && current.equals(start) && s.getOrientation() === o) continue;
                if (Reroute.fits(b, s, start, o)) positions.push(start);
            }
        }
        return positions;
    }

    // true if the ship has somewhere to go in either orientation
    public canMove(b: Board, s: Ship): boolean
    {
        return [Orientation.HORIZONTAL, Orientation.VERTICAL].some(o => this.validPositions(b, s, o).length > 0);
    }

    private static fits(b: Board, s: Ship, start: Coordinate, o: Orientation): boolean
    {
        const squares = Ship.squaresFrom(start, o, s.getLength());
        return b.hasRoomFor(squares, s) && squares.every(sq => !b.hasBeenTargeted(sq));
    }
}
