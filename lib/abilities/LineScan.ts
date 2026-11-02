import { Ability } from "./Ability";
import type { Game } from "../controllers";
import { Coordinate } from "../entities/board";
import type { Board } from "../entities/board";

/**
 * Scans a whole row or column for unshot ship squares.
 * For a row the target's y picks the row, for a column its x picks the column.
 */
export class LineScan extends Ability
{
    private isRow: boolean;
    private revealed: Coordinate[];

    constructor()
    {
        super("Line Scan", true);
        this.isRow = true;
        this.revealed = [];
    }

    public setDirection(isRow: boolean): void { this.isRow = isRow; }

    public getIsRow(): boolean { return this.isRow; }

    // the line is on the board and at least one square in it hasn't been shot
    public isValidTarget(b: Board, t: Coordinate): boolean
    {
        if (!t.isWithinBounds(b.getWidth(), b.getHeight())) return false;
        return this.lineThrough(b, t).some(sq => !b.hasBeenTargeted(sq));
    }

    public apply(g: Game, b: Board, t: Coordinate): void
    {
        this.revealed = b.scanLine(this.indexOf(t), this.isRow);
        this.markUsed();
    }

    // ship squares the last scan found, for the scanning player only
    public getRevealed(): Coordinate[] { return this.revealed; }

    // every square of the row or column the target picks
    public lineThrough(b: Board, t: Coordinate): Coordinate[]
    {
        const index = this.indexOf(t);
        const length = this.isRow ? b.getWidth() : b.getHeight();
        return Array.from({ length }, (_, i) => (this.isRow ? new Coordinate(i, index) : new Coordinate(index, i)));
    }

    private indexOf(t: Coordinate): number { return this.isRow ? t.getY() : t.getX(); }
}
