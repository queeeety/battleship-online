import type { Coordinate } from "./Coordinate";
import { CellState } from "../../enums";
import type { Ship } from "../ships";

/**
 * One square on a board.
 * Knows where it is and if it's empty, has a ship, or was hit/missed.
 */
export class Cell
{
    private coordinate: Coordinate;
    private state: CellState;
    private ship: Ship | null;

    constructor(coordinate: Coordinate)
    {
        this.coordinate = coordinate;
        this.state = CellState.EMPTY;
        this.ship = null;
    }

    public occupy(s: Ship): void
    {
        this.ship = s;
        this.state = CellState.OCCUPIED;
    }

    public clear(): void
    {
        this.ship = null;
        this.state = CellState.EMPTY;
    }

    // the ship stays linked after a hit so the board still knows whose square it was
    public markHit(): void { this.state = CellState.HIT; }

    public markMiss(): void { this.state = CellState.MISS; }

    public isAlreadyShot(): boolean { return this.state === CellState.HIT || this.state === CellState.MISS; }

    public getState(): CellState { return this.state; }

    public getShip(): Ship | null { return this.ship; }

    public getCoordinate(): Coordinate { return this.coordinate; }
}
