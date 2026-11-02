import { describe, it, expect } from "vitest";
import { RequestValidator, InvalidRequestError } from "../../lib/server/RequestValidator";
import { Board } from "../../lib/entities/board";
import { GameType } from "../../lib/enums";

const validator = new RequestValidator();

/** A legal fleet, placed by the same random placement the AI uses. */
function legalLayout()
{
    const board = new Board();
    board.placeFleetRandomly();
    return { ships: board.toSnapshot().ships };
}

/** Runs fn and returns the InvalidRequestError it throws, so a test can check its field. */
function errorFrom(fn: () => unknown): InvalidRequestError
{
    try { fn(); }
    catch (e) { if (e instanceof InvalidRequestError) return e; throw e; }
    throw new Error("expected an InvalidRequestError");
}

describe("RequestValidator.parseCode", () =>
{
    it("accepts a valid code", () =>
    {
        expect(validator.parseCode("4F7K2M")).toBe("4F7K2M");
    });

    it("trims and upper-cases a hand-typed code", () =>
    {
        expect(validator.parseCode(" 4f7k2m ")).toBe("4F7K2M");
    });

    it("rejects the wrong length", () =>
    {
        expect(errorFrom(() => validator.parseCode("4F7K2")).field).toBe("code");
        expect(errorFrom(() => validator.parseCode("4F7K2MX")).field).toBe("code");
    });

    it("rejects the ambiguous characters 0, O, 1, I and L", () =>
    {
        for (const code of ["0F7K2M", "OF7K2M", "1F7K2M", "IF7K2M", "LF7K2M"])
        {
            expect(() => validator.parseCode(code)).toThrow(InvalidRequestError);
        }
    });

    it("rejects anything that isn't a string", () =>
    {
        expect(() => validator.parseCode(123456)).toThrow(InvalidRequestError);
        expect(() => validator.parseCode(undefined)).toThrow(InvalidRequestError);
    });
});

describe("RequestValidator.parseName", () =>
{
    it("accepts and trims a normal name", () =>
    {
        expect(validator.parseName("  Nathan ")).toBe("Nathan");
    });

    it("accepts exactly 16 characters", () =>
    {
        expect(validator.parseName("A".repeat(16))).toBe("A".repeat(16));
    });

    it("rejects 17 characters", () =>
    {
        expect(errorFrom(() => validator.parseName("A".repeat(17))).field).toBe("name");
    });

    it("returns null for blank or missing names so a random one can be assigned", () =>
    {
        expect(validator.parseName("")).toBeNull();
        expect(validator.parseName("   ")).toBeNull();
        expect(validator.parseName(undefined)).toBeNull();
        expect(validator.parseName(null)).toBeNull();
    });

    it("rejects anything that isn't a string", () =>
    {
        expect(() => validator.parseName(42)).toThrow(InvalidRequestError);
    });
});

describe("RequestValidator.parseCoordinate", () =>
{
    it("turns {row, col} into a Coordinate", () =>
    {
        const c = validator.parseCoordinate({ row: 7, col: 7 });
        expect(c.toRowCol()).toEqual({ row: 7, col: 7 });
    });

    it("accepts the corners of the board", () =>
    {
        expect(validator.parseCoordinate({ row: 0, col: 0 }).toRowCol()).toEqual({ row: 0, col: 0 });
        expect(validator.parseCoordinate({ row: 9, col: 9 }).toRowCol()).toEqual({ row: 9, col: 9 });
    });

    it("rejects squares off the board", () =>
    {
        for (const raw of [{ row: -1, col: 0 }, { row: 10, col: 0 }, { row: 0, col: 10 }])
        {
            expect(errorFrom(() => validator.parseCoordinate(raw)).field).toBe("coordinate");
        }
    });

    it("rejects non-whole numbers and missing fields", () =>
    {
        expect(() => validator.parseCoordinate({ row: 1.5, col: 2 })).toThrow(InvalidRequestError);
        expect(() => validator.parseCoordinate({ row: 1 })).toThrow(InvalidRequestError);
        expect(() => validator.parseCoordinate("H8")).toThrow(InvalidRequestError);
    });
});

describe("RequestValidator.parseLayout", () =>
{
    it("accepts a legal fleet and returns a Board with every ship on it", () =>
    {
        const board = validator.parseLayout(legalLayout());
        expect(board.isFleetComplete()).toBe(true);
    });

    it("rejects a fleet with a ship missing", () =>
    {
        const layout = legalLayout();
        layout.ships.pop();
        expect(errorFrom(() => validator.parseLayout(layout)).field).toBe("layout");
    });

    it("rejects overlapping ships", () =>
    {
        const layout = legalLayout();
        layout.ships[1] = { ...layout.ships[1], row: layout.ships[0].row, col: layout.ships[0].col, orientation: layout.ships[0].orientation };
        expect(errorFrom(() => validator.parseLayout(layout)).field).toBe("layout");
    });

    it("rejects the same ship twice", () =>
    {
        const layout = legalLayout();
        layout.ships[1] = { ...layout.ships[1], name: layout.ships[0].name };
        expect(errorFrom(() => validator.parseLayout(layout)).field).toBe("layout");
    });

    it("rejects a ship that runs off the board", () =>
    {
        const layout = legalLayout();
        layout.ships[0] = { ...layout.ships[0], row: 9, col: 9, orientation: "horizontal" };
        expect(errorFrom(() => validator.parseLayout(layout)).field).toBe("layout");
    });

    it("rejects a malformed layout", () =>
    {
        expect(() => validator.parseLayout({ ships: "lots" })).toThrow(InvalidRequestError);
        expect(() => validator.parseLayout(null)).toThrow(InvalidRequestError);
    });
});

describe("RequestValidator.parseGameType", () =>
{
    it("accepts each game type", () =>
    {
        expect(validator.parseGameType(GameType.BEGINNER)).toBe(GameType.BEGINNER);
        expect(validator.parseGameType(GameType.ORIGINAL)).toBe(GameType.ORIGINAL);
        expect(validator.parseGameType(GameType.QUICK_FIRE)).toBe(GameType.QUICK_FIRE);
    });

    it("rejects anything else", () =>
    {
        expect(errorFrom(() => validator.parseGameType(3)).field).toBe("gameType");
        expect(() => validator.parseGameType("ORIGINAL")).toThrow(InvalidRequestError);
    });
});
