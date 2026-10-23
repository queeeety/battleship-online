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

    public occupy(s: Ship): void {}

    public clear(): void {}

    public markHit(): void {}

    public markMiss(): void {}

    public isAlreadyShot(): boolean { return false; }

    public getState(): CellState { return this.state; }

    public getShip(): Ship | null { return this.ship; }
}

