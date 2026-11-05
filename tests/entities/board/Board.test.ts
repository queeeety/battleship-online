import { describe, it, expect } from "vitest";
import { Board } from "../../../lib/entities/board/Board";
import { Coordinate } from "../../../lib/entities/board/Coordinate";
import { Carrier, Destroyer, Submarine } from "../../../lib/entities/ships";
import { HumanPlayer } from "../../../lib/entities/players";
import { CellState, Orientation, ShotResult } from "../../../lib/enums";
import { placeKnownFleet, knownFleetSquares, OPEN_WATER } from "../../helpers";

const shooter = new HumanPlayer("Cian", "s1");

describe("Board placement", () =>
{
    it("starts with 100 empty cells and no ships", () =>
    {
        const b = new Board();
        expect(b.getUntargetedCoordinates()).toHaveLength(100);
        expect(b.getShips()).toHaveLength(0);
        expect(b.getCell(new Coordinate(9, 9)).getState()).toBe(CellState.EMPTY);
    });

    it("rejects a ship that runs off the edge", () =>
    {
        const b = new Board();
        expect(b.canPlace(new Carrier(), new Coordinate(6, 0), Orientation.HORIZONTAL)).toBe(false);
        expect(b.canPlace(new Carrier(), new Coordinate(0, 6), Orientation.VERTICAL)).toBe(false);
        expect(b.canPlace(new Carrier(), new Coordinate(5, 0), Orientation.HORIZONTAL)).toBe(true);
    });

    it("rejects a ship that overlaps another", () =>
    {
        const b = new Board();
        b.placeShip(new Carrier(), new Coordinate(0, 0), Orientation.HORIZONTAL);
        expect(b.placeShip(new Destroyer(), new Coordinate(4, 0), Orientation.VERTICAL)).toBe(false);
        expect(b.placeShip(new Destroyer(), new Coordinate(6, 0), Orientation.VERTICAL)).toBe(true);
    });

    it("rejects placing the same ship twice", () =>
    {
        const b = new Board();
        const ship = new Destroyer();
        b.placeShip(ship, new Coordinate(0, 0), Orientation.HORIZONTAL);
        expect(b.placeShip(ship, new Coordinate(0, 5), Orientation.HORIZONTAL)).toBe(false);
    });

    it("keeps a free square around every ship, corners included", () =>
    {
        const b = new Board();
        b.placeShip(new Destroyer(), new Coordinate(0, 0), Orientation.HORIZONTAL);
        expect(b.canPlace(new Submarine(), new Coordinate(0, 1), Orientation.HORIZONTAL)).toBe(false);
        expect(b.canPlace(new Submarine(), new Coordinate(2, 0), Orientation.HORIZONTAL)).toBe(false);
        expect(b.canPlace(new Submarine(), new Coordinate(2, 1), Orientation.HORIZONTAL)).toBe(false);
        expect(b.canPlace(new Submarine(), new Coordinate(3, 0), Orientation.HORIZONTAL)).toBe(true);
        expect(b.placeShip(new Submarine(), new Coordinate(0, 2), Orientation.HORIZONTAL)).toBe(true);
    });

    it("removeShip frees its squares for another ship", () =>
    {
        const b = new Board();
        const carrier = new Carrier();
        b.placeShip(carrier, new Coordinate(0, 0), Orientation.HORIZONTAL);
        b.removeShip(carrier);
        expect(b.getShips()).toHaveLength(0);
        expect(carrier.getIsPlaced()).toBe(false);
        expect(b.placeShip(new Destroyer(), new Coordinate(0, 0), Orientation.HORIZONTAL)).toBe(true);
    });

    it("fleet is complete only with all five standard ships", () =>
    {
        const b = new Board();
        b.placeShip(new Carrier(), new Coordinate(0, 0), Orientation.HORIZONTAL);
        expect(b.isFleetComplete()).toBe(false);
        expect(placeKnownFleet().isFleetComplete()).toBe(true);
    });

    it("random fleets are always complete and never overlap or touch (200 runs)", () =>
    {
        for (let run = 0; run < 200; run++)
        {
            const b = new Board();
            b.placeFleetRandomly();
            expect(b.isFleetComplete()).toBe(true);
            const squares = b.getShips().flatMap(s => s.getCoordinates());
            expect(squares).toHaveLength(17);
            expect(new Set(squares.map(c => c.key())).size).toBe(17);
            expect(squares.every(c => c.isWithinBounds(10, 10))).toBe(true);
            expect(b.getShips().every(s => b.hasRoomFor(s.getCoordinates(), s))).toBe(true);
        }
    });
});

describe("Board shots", () =>
{
    it("a ship square is a hit and anything else a miss", () =>
    {
        const b = placeKnownFleet();
        const hit = b.receiveShot(new Coordinate(0, 0), shooter);
        expect(hit.getResult()).toBe(ShotResult.HIT);
        expect(hit.getShooter()).toBe(shooter);
        expect(b.getCell(new Coordinate(0, 0)).getState()).toBe(CellState.HIT);

        const miss = b.receiveShot(OPEN_WATER, shooter);
        expect(miss.getResult()).toBe(ShotResult.MISS);
        expect(b.getCell(OPEN_WATER).getState()).toBe(CellState.MISS);
    });

    it("the last square of a ship is SUNK with its name", () =>
    {
        const b = placeKnownFleet();
        b.receiveShot(new Coordinate(0, 8), shooter);
        const shot = b.receiveShot(new Coordinate(1, 8), shooter);
        expect(shot.getResult()).toBe(ShotResult.SUNK);
        expect(shot.getSunkShipName()).toBe("Destroyer");
        expect(shot.isHit()).toBe(true);
    });

    it("rejects a square that was already targeted without changing the board", () =>
    {
        const b = placeKnownFleet();
        b.receiveShot(new Coordinate(0, 0), shooter);
        expect(() => b.receiveShot(new Coordinate(0, 0), shooter)).toThrow();
        expect(b.getShips()[0].getHits()).toBe(1);
    });

    it("rejects a square off the board", () =>
    {
        expect(() => placeKnownFleet().receiveShot(new Coordinate(10, 0), shooter)).toThrow();
    });

    it("all ships sunk only once every ship square is hit", () =>
    {
        const b = placeKnownFleet();
        const squares = knownFleetSquares();
        squares.slice(0, -1).forEach(c => b.receiveShot(c, shooter));
        expect(b.allShipsSunk()).toBe(false);
        b.receiveShot(squares[squares.length - 1], shooter);
        expect(b.allShipsSunk()).toBe(true);
    });

    it("an empty board is never all sunk", () =>
    {
        expect(new Board().allShipsSunk()).toBe(false);
    });
});

describe("Board scans and moves", () =>
{
    it("scanArea returns only unshot ship squares, clipped to the board", () =>
    {
        const b = placeKnownFleet();
        b.receiveShot(new Coordinate(0, 0), shooter);
        const found = b.scanArea(new Coordinate(0, 0), 3).map(c => c.key());
        expect(found.sort()).toEqual(["1,0", "2,0", "0,2", "1,2", "2,2"].sort());
        expect(b.scanArea(new Coordinate(8, 8), 3)).toEqual([]);
    });

    it("scanLine returns unshot ship squares in a row or column", () =>
    {
        const b = placeKnownFleet();
        expect(b.scanLine(8, true).map(c => c.key())).toEqual(["0,8", "1,8"]);
        expect(b.scanLine(4, false).map(c => c.key())).toEqual(["4,0"]);
        expect(b.scanLine(9, true)).toEqual([]);
    });

    it("moveShip moves an undamaged ship to free water", () =>
    {
        const b = placeKnownFleet();
        const destroyer = b.getShips().find(s => s.getName() === "Destroyer")!;
        expect(b.moveShip(destroyer, new Coordinate(8, 8), Orientation.VERTICAL)).toBe(true);
        expect(b.getCell(new Coordinate(0, 8)).getShip()).toBeNull();
        expect(b.getCell(new Coordinate(8, 9)).getShip()).toBe(destroyer);
    });

    it("moveShip rejects a spot covering a square the opponent fired at, and leaves the ship where it was", () =>
    {
        const b = placeKnownFleet();
        b.receiveShot(new Coordinate(8, 9), shooter);
        const destroyer = b.getShips().find(s => s.getName() === "Destroyer")!;
        expect(b.moveShip(destroyer, new Coordinate(8, 8), Orientation.VERTICAL)).toBe(false);
        expect(b.getCell(new Coordinate(0, 8)).getShip()).toBe(destroyer);
        expect(destroyer.getStart()!.key()).toBe("0,8");
    });

    it("moveShip rejects a damaged ship", () =>
    {
        const b = placeKnownFleet();
        b.receiveShot(new Coordinate(0, 8), shooter);
        const destroyer = b.getShips().find(s => s.getName() === "Destroyer")!;
        expect(b.moveShip(destroyer, new Coordinate(8, 8), Orientation.VERTICAL)).toBe(false);
    });

    it("moveShip may overlap the ship's own old squares", () =>
    {
        const b = placeKnownFleet();
        const destroyer = b.getShips().find(s => s.getName() === "Destroyer")!;
        expect(b.moveShip(destroyer, new Coordinate(1, 8), Orientation.HORIZONTAL)).toBe(true);
        expect(destroyer.getCoordinates().map(c => c.key())).toEqual(["1,8", "2,8"]);
    });

    it("moveShip keeps the free square around other ships", () =>
    {
        const b = placeKnownFleet();
        const destroyer = b.getShips().find(s => s.getName() === "Destroyer")!;
        expect(b.moveShip(destroyer, new Coordinate(0, 7), Orientation.HORIZONTAL)).toBe(false);
        expect(destroyer.getStart()!.key()).toBe("0,8");
    });
});

describe("Board snapshot", () =>
{
    it("round-trips ships, hits, misses and sunk ships", () =>
    {
        const b = placeKnownFleet();
        b.receiveShot(new Coordinate(0, 8), shooter);
        b.receiveShot(new Coordinate(1, 8), shooter);
        b.receiveShot(new Coordinate(0, 0), shooter);
        b.receiveShot(OPEN_WATER, shooter);

        const snapshot = JSON.parse(JSON.stringify(b.toSnapshot()));
        const restored = Board.fromSnapshot(snapshot);

        expect(restored.toSnapshot()).toEqual(b.toSnapshot());
        expect(restored.getCell(OPEN_WATER).getState()).toBe(CellState.MISS);
        expect(restored.getShips().find(s => s.getName() === "Destroyer")!.isSunk()).toBe(true);
        expect(restored.getShips().find(s => s.getName() === "Carrier")!.getHits()).toBe(1);
    });

    it("stores coordinates as zero-based {row, col}", () =>
    {
        const snapshot = placeKnownFleet().toSnapshot();
        expect(snapshot.ships[1]).toEqual({ name: "Battleship", row: 2, col: 0, orientation: "horizontal" });
    });

    it("rejects a snapshot with overlapping, touching or duplicate ships", () =>
    {
        const snapshot = placeKnownFleet().toSnapshot();
        expect(() => Board.fromSnapshot({ ...snapshot, ships: [...snapshot.ships, snapshot.ships[0]] })).toThrow();
        const overlapping = { ...snapshot, ships: snapshot.ships.map(s => ({ ...s, row: 0 })) };
        expect(() => Board.fromSnapshot(overlapping)).toThrow();
        const touching = { ...snapshot, ships: snapshot.ships.map((s, i) => ({ ...s, row: i })) };
        expect(() => Board.fromSnapshot(touching)).toThrow();
    });
});
