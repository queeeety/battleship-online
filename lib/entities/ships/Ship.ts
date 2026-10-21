import { Orientation } from "../../enums";
import type { Coordinate } from "../board";

/**
 * Base class for the five ship types.
 * Counts its hits and knows when it's sunk.
 * The subclasses only differ by name and length, see fleet.ts for the full set.
 */
export abstract class Ship
{
    private name: string;
    protected length: number;
    private hits: number;
    private orientation: Orientation;
    private isPlaced: boolean;
    private start: Coordinate | null;

    constructor(name: string, length: number)
    {
        this.name = name;
        this.length = length;
        this.hits = 0;
        this.orientation = Orientation.HORIZONTAL;
        this.isPlaced = false;
        this.start = null;
    }

    public rotate(): void {}

    public place(start: Coordinate, o: Orientation): void {}

    public unplace(): void {}

    public occupies(c: Coordinate): boolean { return false; }

    public registerHit(): void {}

    public isSunk(): boolean { return false; }

    public isDamaged(): boolean { return false; }

    public getName(): string { return this.name; }

    public getLength(): number { return this.length; }

    public getStart(): Coordinate | null { return this.start; }

    public getOrientation(): Orientation { return this.orientation; }
}


