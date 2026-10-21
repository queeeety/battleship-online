import type { Coordinate } from "../entities/board";
import { CellState } from "../enums";

/**
 * Draws one square of a board, with icons for empty, ship, hit, miss and scanned.
 * Focusable so the board works from the keyboard.
 */
export class CellView
{
    private coordinate: Coordinate;
    private state: CellState;
    private scanned: boolean;

    constructor(coordinate: Coordinate)
    {
        this.coordinate = coordinate;
        this.state = CellState.EMPTY;
        this.scanned = false;
    }

    public render(): void {}

    public focus(): void {}
}
