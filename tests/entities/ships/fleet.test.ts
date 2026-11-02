import { describe, it, expect } from "vitest";
import { Carrier, Battleship, Cruiser, Submarine, Destroyer, createStandardFleet, FLEET_SIZE } from "../../../lib/entities/ships";

describe("fleet", () =>
{
    it("the standard fleet is one of each of the five ship types", () =>
    {
        const fleet = createStandardFleet();
        expect(FLEET_SIZE).toBe(5);
        expect(fleet).toHaveLength(FLEET_SIZE);
        expect(fleet[0]).toBeInstanceOf(Carrier);
        expect(fleet[1]).toBeInstanceOf(Battleship);
        expect(fleet[2]).toBeInstanceOf(Cruiser);
        expect(fleet[3]).toBeInstanceOf(Submarine);
        expect(fleet[4]).toBeInstanceOf(Destroyer);
    });

    it("the standard fleet covers 17 squares", () =>
    {
        expect(createStandardFleet().reduce((total, s) => total + s.getLength(), 0)).toBe(17);
    });

    it("every call gives fresh, unplaced, undamaged ships", () =>
    {
        const a = createStandardFleet();
        const b = createStandardFleet();
        a.forEach((ship, i) => expect(ship).not.toBe(b[i]));
        expect(a.every(s => !s.getIsPlaced() && s.getHits() === 0)).toBe(true);
    });
});
