/**
 * A square on the board.
 * x is the column (A-J) and y is the row (1-10), both stored from 0.
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

    public getX(): number { return this.x; }

    public getY(): number { return this.y; }

    public isWithinBounds(w: number, h: number): boolean { return false; }

    public equals(other: Coordinate): boolean { return false; }
}

