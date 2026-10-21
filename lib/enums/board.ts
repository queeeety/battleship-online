/**
 * Enums for the board, its cells and ship placement.
 */

export enum CellState
{
    EMPTY,
    OCCUPIED,
    HIT,
    MISS
}

export enum Orientation
{
    HORIZONTAL,
    VERTICAL
}

export enum PlacementError
{
    OUT_OF_BOUNDS,
    OVERLAPS_SHIP,
    ALREADY_PLACED,
    FLEET_INCOMPLETE
}

