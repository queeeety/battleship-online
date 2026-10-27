/**
 * A square on the board.
 * x is the column (A-J) and y is the row (1-10), both stored from 0.
 * The database stores the same square as {row, col}, so H8 is {row: 7, col: 7}.
 */
export class Coordinate
{
    private x: number;
    private y: number;

    constructor(x: number, y: number)
    {
        this.x = x;
        this.y = y;
    }

    public static fromRowCol(row: number, col: number): Coordinate { return new Coordinate(col, row); }

    public getX(): number { return this.x; }

    public getY(): number { return this.y; }

    public isWithinBounds(w: number, h: number): boolean
    {
        return Number.isInteger(this.x) && Number.isInteger(this.y)
            && this.x >= 0 && this.x < w
            && this.y >= 0 && this.y < h;
    }

    public equals(other: Coordinate): boolean { return this.x === other.x && this.y === other.y; }

    public toRowCol(): { row: number; col: number } { return { row: this.y, col: this.x }; }

    // for using coordinates as Set / Map keys
    public key(): string { return `${this.x},${this.y}`; }
}
