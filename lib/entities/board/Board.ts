import type { Cell } from "./Cell";
import type { Coordinate } from "./Coordinate";
import type { Ship } from "../ships";
import type { Shot } from "../game";
import type { Orientation } from "../../enums";
import { BOARD_SIZE } from "../../config";

/**
 * One player's 10x10 grid and the ships on it.
 * Placement gets checked on the client first and then again on the server.
 */
export class Board
{
    private static readonly SIZE: number = BOARD_SIZE;

    private width: number;
    private height: number;
    private cells: Cell[][];
    private ships: Ship[];

    constructor()
    {
        this.width = Board.SIZE;
        this.height = Board.SIZE;
        this.cells = [];
        this.ships = [];
    }

    public canPlace(s: Ship, start: Coordinate, o: Orientation): boolean { return false; }

    public placeShip(s: Ship, start: Coordinate, o: Orientation): boolean { return false; }

    public removeShip(s: Ship): void {}

    public placeFleetRandomly(): void {}

    public isFleetComplete(): boolean { return false; }

    public receiveShot(target: Coordinate): Shot { throw new Error("not implemented"); }

    public hasBeenTargeted(c: Coordinate): boolean { return false; }

    public allShipsSunk(): boolean { return false; }

    public scanArea(topLeft: Coordinate, size: number): Coordinate[] { return []; }

    public scanLine(index: number, isRow: boolean): Coordinate[] { return []; }

    public moveShip(s: Ship, start: Coordinate, o: Orientation): boolean { return false; }

    public reset(): void {}

    public getCell(c: Coordinate): Cell { throw new Error("not implemented"); }

    public getShips(): Ship[] { return this.ships; }
}

