import { describe, it, expect } from "vitest";
import { nextPosition } from "../../hooks/useGridKeyboardNav";

const SIZE = 10;
const MIDDLE = { x: 4, y: 4 };

describe("nextPosition", () =>
{
    it("moves one square with each arrow", () =>
    {
        expect(nextPosition("ArrowUp", false, MIDDLE, SIZE)).toEqual({ x: 4, y: 3 });
        expect(nextPosition("ArrowDown", false, MIDDLE, SIZE)).toEqual({ x: 4, y: 5 });
        expect(nextPosition("ArrowLeft", false, MIDDLE, SIZE)).toEqual({ x: 3, y: 4 });
        expect(nextPosition("ArrowRight", false, MIDDLE, SIZE)).toEqual({ x: 5, y: 4 });
    });

    it("stops at the edges instead of wrapping", () =>
    {
        expect(nextPosition("ArrowUp", false, { x: 0, y: 0 }, SIZE)).toEqual({ x: 0, y: 0 });
        expect(nextPosition("ArrowLeft", false, { x: 0, y: 0 }, SIZE)).toEqual({ x: 0, y: 0 });
        expect(nextPosition("ArrowDown", false, { x: 9, y: 9 }, SIZE)).toEqual({ x: 9, y: 9 });
        expect(nextPosition("ArrowRight", false, { x: 9, y: 9 }, SIZE)).toEqual({ x: 9, y: 9 });
    });

    it("Home and End jump along the row", () =>
    {
        expect(nextPosition("Home", false, MIDDLE, SIZE)).toEqual({ x: 0, y: 4 });
        expect(nextPosition("End", false, MIDDLE, SIZE)).toEqual({ x: 9, y: 4 });
    });

    it("Ctrl or Cmd with Home and End jump to the corners", () =>
    {
        expect(nextPosition("Home", true, MIDDLE, SIZE)).toEqual({ x: 0, y: 0 });
        expect(nextPosition("End", true, MIDDLE, SIZE)).toEqual({ x: 9, y: 9 });
    });

    it("PageUp and PageDown jump along the column", () =>
    {
        expect(nextPosition("PageUp", false, MIDDLE, SIZE)).toEqual({ x: 4, y: 0 });
        expect(nextPosition("PageDown", false, MIDDLE, SIZE)).toEqual({ x: 4, y: 9 });
    });

    it("returns null for keys it doesn't handle, so Enter and Space can fire", () =>
    {
        expect(nextPosition("Enter", false, MIDDLE, SIZE)).toBeNull();
        expect(nextPosition(" ", false, MIDDLE, SIZE)).toBeNull();
        expect(nextPosition("a", false, MIDDLE, SIZE)).toBeNull();
    });

    it("respects a smaller board size", () =>
    {
        expect(nextPosition("End", true, { x: 0, y: 0 }, 5)).toEqual({ x: 4, y: 4 });
        expect(nextPosition("ArrowRight", false, { x: 4, y: 2 }, 5)).toEqual({ x: 4, y: 2 });
    });
});
