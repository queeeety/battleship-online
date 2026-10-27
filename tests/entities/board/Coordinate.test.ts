import { describe, it, expect } from "vitest";
import { Coordinate } from "../../../lib/entities/board/Coordinate";

describe("Coordinate", () =>
{
    it("is within bounds only inside a 10x10 grid", () =>
    {
        expect(new Coordinate(0, 0).isWithinBounds(10, 10)).toBe(true);
        expect(new Coordinate(9, 9).isWithinBounds(10, 10)).toBe(true);
        expect(new Coordinate(10, 0).isWithinBounds(10, 10)).toBe(false);
        expect(new Coordinate(0, -1).isWithinBounds(10, 10)).toBe(false);
        expect(new Coordinate(1.5, 0).isWithinBounds(10, 10)).toBe(false);
    });

    it("equals another coordinate with the same x and y", () =>
    {
        expect(new Coordinate(3, 4).equals(new Coordinate(3, 4))).toBe(true);
        expect(new Coordinate(3, 4).equals(new Coordinate(4, 3))).toBe(false);
    });

    it("maps H8 to {row: 7, col: 7} and x to the column", () =>
    {
        const h8 = Coordinate.fromRowCol(7, 7);
        expect(h8.toRowCol()).toEqual({ row: 7, col: 7 });
        expect(Coordinate.fromRowCol(2, 5).getX()).toBe(5);
        expect(Coordinate.fromRowCol(2, 5).getY()).toBe(2);
    });

    it("gives equal coordinates the same key", () =>
    {
        expect(new Coordinate(2, 3).key()).toBe(new Coordinate(2, 3).key());
        expect(new Coordinate(2, 3).key()).not.toBe(new Coordinate(3, 2).key());
    });
});
