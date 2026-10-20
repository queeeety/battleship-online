import { Orientation } from "./enums";
import { Coordinate } from "./Coordinate";

/**
 * Base class for the five ship types.
 * Counts its hits and knows when it's sunk.
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

    public rotate(): void
    {
        this.orientation = this.orientation == Orientation.HORIZONTAL ? Orientation.VERTICAL : Orientation.HORIZONTAL;
    }

    public occupies(c: Coordinate): boolean { return false; }

    public registerHit(): void { this.hits++; }

    public isSunk(): boolean { return this.hits >= this.length; }

    public getName(): string { return this.name; }

    public getLength(): number { return this.length; }
}

// the subclasses only differ by name and length

export class Carrier extends Ship
{
    constructor() { super("Carrier", 5); }
}

export class Battleship extends Ship
{
    constructor() { super("Battleship", 4); }
}

export class Cruiser extends Ship
{
    constructor() { super("Cruiser", 3); }
}

export class Submarine extends Ship
{
    constructor() { super("Submarine", 3); }
}

export class Destroyer extends Ship
{
    constructor() { super("Destroyer", 2); }
}
