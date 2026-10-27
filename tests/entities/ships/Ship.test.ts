import { describe, it, expect } from "vitest";
import { Carrier, Battleship, Cruiser, Submarine, Destroyer, createStandardFleet, FLEET_SIZE } from "../../../lib/entities/ships";
import { Coordinate } from "../../../lib/entities/board/Coordinate";
import { Orientation } from "../../../lib/enums";

describe("Ship", () =>
{
    it("subclasses only differ by name and length", () =>
    {
        expect([new Carrier(), new Battleship(), new Cruiser(), new Submarine(), new Destroyer()]
            .map(s => [s.getName(), s.getLength()]))
            .toEqual([["Carrier", 5], ["Battleship", 4], ["Cruiser", 3], ["Submarine", 3], ["Destroyer", 2]]);
    });

    it("standard fleet is five fresh ships every call", () =>
    {
        const a = createStandardFleet();
        const b = createStandardFleet();
        expect(a).toHaveLength(FLEET_SIZE);
        expect(FLEET_SIZE).toBe(5);
        expect(a[0]).not.toBe(b[0]);
    });

    it("sinks only once every square is hit, and extra hits don't count", () =>
    {
        const ship = new Destroyer();
        expect(ship.isSunk()).toBe(false);
        ship.registerHit();
        expect(ship.isDamaged()).toBe(true);
        expect(ship.isSunk()).toBe(false);
        ship.registerHit();
        expect(ship.isSunk()).toBe(true);
        ship.registerHit();
        expect(ship.getHits()).toBe(2);
    });

    it("occupies the squares from its start along its orientation", () =>
    {
        const ship = new Cruiser();
        ship.place(new Coordinate(2, 3), Orientation.VERTICAL);
        expect(ship.getCoordinates().map(c => c.key())).toEqual(["2,3", "2,4", "2,5"]);
        expect(ship.occupies(new Coordinate(2, 5))).toBe(true);
        expect(ship.occupies(new Coordinate(3, 3))).toBe(false);
    });

    it("occupies nothing before it is placed", () =>
    {
        expect(new Carrier().occupies(new Coordinate(0, 0))).toBe(false);
        expect(new Carrier().getCoordinates()).toEqual([]);
    });

    it("rotates before placement but not after", () =>
    {
        const ship = new Battleship();
        ship.rotate();
        expect(ship.getOrientation()).toBe(Orientation.VERTICAL);
        ship.place(new Coordinate(0, 0), Orientation.HORIZONTAL);
        ship.rotate();
        expect(ship.getOrientation()).toBe(Orientation.HORIZONTAL);
    });

    it("unplace clears its position and hits", () =>
    {
        const ship = new Destroyer();
        ship.place(new Coordinate(0, 0), Orientation.HORIZONTAL);
        ship.registerHit();
        ship.unplace();
        expect(ship.getIsPlaced()).toBe(false);
        expect(ship.getStart()).toBeNull();
        expect(ship.getHits()).toBe(0);
    });
});
