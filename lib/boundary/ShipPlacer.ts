import type { Coordinate } from "../entities/board";
import type { Ship } from "../entities/ships";
import { Orientation } from "../enums";

/**
 * The placement screen: pick a ship, rotate it, drop it on the board,
 * randomise the fleet and confirm.
 */
export class ShipPlacer
{
    private selectedShip: Ship | null;
    private orientation: Orientation;

    constructor()
    {
        this.selectedShip = null;
        this.orientation = Orientation.HORIZONTAL;
    }

    public selectShip(s: Ship): void {}

    public rotate(): void {}

    public showDropOutline(c: Coordinate): void {}

    public dropAt(c: Coordinate): boolean { return false; }

    public randomise(): void {}

    public confirm(): void {}
}
