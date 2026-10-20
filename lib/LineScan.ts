import { Ability } from "./Ability";
import { Game } from "./Game";
import { Board } from "./Board";
import { Coordinate } from "./Coordinate";

/**
 * Scans a whole row or column for unshot ship squares.
 */
export class LineScan extends Ability
{
    private isRow: boolean;

    constructor()
    {
        super("Line Scan", true);
        this.isRow = true;
    }

    public setDirection(isRow: boolean): void { this.isRow = isRow; }

    public isValidTarget(b: Board, t: Coordinate): boolean { return false; }

    public apply(g: Game, b: Board, t: Coordinate): void {}
}
