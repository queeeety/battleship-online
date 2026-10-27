import { Orientation } from "../../enums";
import { Coordinate } from "../board/Coordinate";

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

    // only before placement, a placed ship has to be moved through the Board
    public rotate(): void
    {
        if (this.isPlaced) return;
        this.orientation = this.orientation === Orientation.HORIZONTAL ? Orientation.VERTICAL : Orientation.HORIZONTAL;
    }

    public occupies(c: Coordinate): boolean
    {
        return this.getCoordinates().some(sq => sq.equals(c));
    }

    public registerHit(): void
    {
        if (this.hits < this.length) this.hits++;
    }

    public isSunk(): boolean { return this.hits >= this.length; }

    public isDamaged(): boolean { return this.hits > 0; }

    // called by Board only, so the ship and the cells never disagree
    public place(start: Coordinate, o: Orientation): void
    {
        this.start = start;
        this.orientation = o;
        this.isPlaced = true;
    }

    public unplace(): void
    {
        this.start = null;
        this.isPlaced = false;
        this.hits = 0;
    }

    // the squares this ship covers, or none if it isn't placed
    public getCoordinates(): Coordinate[]
    {
        if (!this.start) return [];
        return Ship.squaresFrom(this.start, this.orientation, this.length);
    }

    public static squaresFrom(start: Coordinate, o: Orientation, length: number): Coordinate[]
    {
        const squares: Coordinate[] = [];
        for (let i = 0; i < length; i++)
        {
            squares.push(o === Orientation.HORIZONTAL
                ? new Coordinate(start.getX() + i, start.getY())
                : new Coordinate(start.getX(), start.getY() + i));
        }
        return squares;
    }

    public getName(): string { return this.name; }

    public getLength(): number { return this.length; }

    public getHits(): number { return this.hits; }

    public getIsPlaced(): boolean { return this.isPlaced; }

    public getStart(): Coordinate | null { return this.start; }

    public getOrientation(): Orientation { return this.orientation; }
}
