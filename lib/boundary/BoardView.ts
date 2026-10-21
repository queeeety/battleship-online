import type { Board, Coordinate } from "../entities/board";
import type { Shot } from "../entities/game";
import type { CellView } from "./CellView";

/**
 * Draws one 10x10 grid, either your own board or the enemy's.
 * Passes cell clicks on when it is clickable.
 */
export class BoardView
{
    private isOwn: boolean;
    private clickable: boolean;
    private cells: CellView[];

    constructor(isOwn: boolean)
    {
        this.isOwn = isOwn;
        this.clickable = false;
        this.cells = [];
    }

    public render(b: Board, shots: Shot[]): void {}

    public highlight(cells: Coordinate[]): void {}

    public setClickable(on: boolean): void {}

    public onCellClick(c: Coordinate): void {}
}
