import { describe, it, expect } from "vitest";
import { Cell } from "../../../lib/entities/board/Cell";
import { Coordinate } from "../../../lib/entities/board/Coordinate";
import { Destroyer } from "../../../lib/entities/ships";
import { CellState } from "../../../lib/enums";

describe("Cell", () =>
{
    it("starts empty and unshot", () =>
    {
        const cell = new Cell(new Coordinate(1, 1));
        expect(cell.getState()).toBe(CellState.EMPTY);
        expect(cell.getShip()).toBeNull();
        expect(cell.isAlreadyShot()).toBe(false);
    });

    it("occupy and clear set and remove the ship", () =>
    {
        const cell = new Cell(new Coordinate(1, 1));
        const ship = new Destroyer();
        cell.occupy(ship);
        expect(cell.getState()).toBe(CellState.OCCUPIED);
        expect(cell.getShip()).toBe(ship);
        cell.clear();
        expect(cell.getState()).toBe(CellState.EMPTY);
        expect(cell.getShip()).toBeNull();
    });

    it("counts as already shot after a hit or a miss, and keeps the ship after a hit", () =>
    {
        const hit = new Cell(new Coordinate(0, 0));
        const ship = new Destroyer();
        hit.occupy(ship);
        hit.markHit();
        expect(hit.getState()).toBe(CellState.HIT);
        expect(hit.isAlreadyShot()).toBe(true);
        expect(hit.getShip()).toBe(ship);

        const miss = new Cell(new Coordinate(0, 1));
        miss.markMiss();
        expect(miss.getState()).toBe(CellState.MISS);
        expect(miss.isAlreadyShot()).toBe(true);
    });
});
