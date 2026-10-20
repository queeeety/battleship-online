import { Cell } from "./Cell";
import { Ship } from "./Ship";
import { Shot } from "./Shot";
import { Coordinate } from "./Coordinate";
import { Orientation } from "./enums";

/**
 * One player's 10x10 grid and the ships on it.
 * Placement gets checked on the client first and then again on the server.
 */
export class Board
{
    private static readonly SIZE = 10;

    private width: number;
    private height: number;
    private cells: Cell[][];
    private ships: Ship[];

    constructor()
    {
        this.width = Board.SIZE;
        this.height = Board.SIZE;
        this.cells = [];
        for (let y = 0; y < this.height; y++)
        {
            this.cells[y] = [];
            for (let x = 0; x < this.width; x++)
            {
                this.cells[y][x] = new Cell(new Coordinate(x, y));
            }
        }
        this.ships = [];
    }

    public canPlace(s: Ship, start: Coordinate, o: Orientation): boolean { return false; }

    public placeShip(s: Ship, start: Coordinate, o: Orientation): boolean { return false; }

    public removeShip(s: Ship): void {}

    public placeFleetRandomly(): void {}

    public isFleetComplete(): boolean { return this.ships.length == 5; }

    public receiveShot(target: Coordinate): Shot { throw new Error("not implemented"); }

    public hasBeenTargeted(c: Coordinate): boolean { return this.cells[c.getY()][c.getX()].isAlreadyShot(); }

    public allShipsSunk(): boolean { return this.ships.every(s => s.isSunk()); }

    // returns the unshot squares in the area that have a ship on them
    public scanArea(topLeft: Coordinate, size: number): Coordinate[] { return []; }

    public scanLine(index: number, isRow: boolean): Coordinate[] { return []; }

    // used by Reroute
    public moveShip(s: Ship, start: Coordinate, o: Orientation): boolean { return false; }

    public reset(): void {}

    public getCell(c: Coordinate): Cell { return this.cells[c.getY()][c.getX()]; }

    public getShips(): Ship[] { return this.ships; }
}
