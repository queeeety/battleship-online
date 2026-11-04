import { describe, it, expect } from "vitest";
import { DoubleShot, LineScan, RadarSweep, Reroute } from "../../lib/abilities";
import { createAbility } from "../../lib/abilities/registry";
import { AbilityCard, scannedSquares } from "../../lib/boundary/AbilityCard";
import { Board, Coordinate } from "../../lib/entities/board";
import { Destroyer } from "../../lib/entities/ships";
import type { Ship } from "../../lib/entities/ships";
import { Orientation } from "../../lib/enums";

// the enemy board as the client knows it: no ships, only the shots fired at it
function knownEnemy(shots: { row: number; col: number }[] = []): Board
{
    return Board.fromSnapshot({ ships: [], shots });
}

function armed(ability: RadarSweep | LineScan | Reroute | DoubleShot): AbilityCard
{
    const card = new AbilityCard();
    card.show(ability);
    card.arm();
    return card;
}

// a board with just a Destroyer at A1-B1
function loneDestroyer(): { board: Board; ship: Ship }
{
    const board = new Board();
    const ship = new Destroyer();
    board.placeShip(ship, new Coordinate(0, 0), Orientation.HORIZONTAL);
    return { board, ship };
}

describe("AbilityCard", () =>
{
    it("starts empty and won't arm without an ability", () =>
    {
        const card = new AbilityCard();
        expect(card.getAbility()).toBeNull();
        expect(() => card.arm()).toThrow();
    });

    it("arms a targeted ability and cancel disarms it", () =>
    {
        const card = new AbilityCard();
        card.show(new RadarSweep());
        expect(card.arm()).toBe("armed");
        expect(card.isArmed()).toBe(true);
        card.cancel();
        expect(card.isArmed()).toBe(false);
    });

    it("Double Shot fires straight away with no target", () =>
    {
        const card = new AbilityCard();
        card.show(new DoubleShot());
        expect(card.arm()).toBe("fire-now");
        expect(card.isArmed()).toBe(false);
        expect(card.toRequest()).toEqual({ name: "Double Shot" });
    });

    it("showing a new ability drops targeting in progress", () =>
    {
        const card = armed(new LineScan());
        card.rotate();
        card.show(new RadarSweep());
        expect(card.isArmed()).toBe(false);
        expect(card.isLineRow()).toBe(true);
    });

    it("previews nothing until armed", () =>
    {
        const card = new AbilityCard();
        card.show(new RadarSweep());
        expect(card.previewAt(knownEnemy(), new Coordinate(0, 0))).toBeNull();
        expect(card.isValidTarget(knownEnemy(), new Coordinate(0, 0))).toBe(false);
    });

    describe("Radar Sweep", () =>
    {
        it("aims at the enemy board and previews the 3x3 area from the top left", () =>
        {
            const card = armed(new RadarSweep());
            expect(card.targetBoard()).toBe("target");
            const preview = card.previewAt(knownEnemy(), new Coordinate(2, 3))!;
            expect(preview.valid).toBe(true);
            expect(preview.squares).toHaveLength(9);
            expect(preview.squares[0].equals(new Coordinate(2, 3))).toBe(true);
            expect(preview.squares[8].equals(new Coordinate(4, 5))).toBe(true);
        });

        it("can't hang off the edge of the board", () =>
        {
            const card = armed(new RadarSweep());
            const preview = card.previewAt(knownEnemy(), new Coordinate(8, 0))!;
            expect(preview.valid).toBe(false);
            expect(preview.squares).toHaveLength(6); // only the on-board part is drawn
            expect(card.isValidTarget(knownEnemy(), new Coordinate(7, 7))).toBe(true);
        });

        it("refuses an area that's all been shot, but allows a shot square as the corner", () =>
        {
            const area = RadarSweep.areaFrom(new Coordinate(0, 0)).map(c => c.toRowCol());
            const card = armed(new RadarSweep());
            expect(card.isValidTarget(knownEnemy(area), new Coordinate(0, 0))).toBe(false);
            expect(card.isValidTarget(knownEnemy([{ row: 0, col: 0 }]), new Coordinate(0, 0))).toBe(true);
        });

        it("asks the server for a plain Radar Sweep", () =>
        {
            expect(armed(new RadarSweep()).toRequest()).toEqual({ name: "Radar Sweep" });
        });
    });

    describe("Line Scan", () =>
    {
        it("scans a row by default and R switches to a column", () =>
        {
            const card = armed(new LineScan());
            const t = new Coordinate(3, 6);
            const row = card.previewAt(knownEnemy(), t)!.squares;
            expect(row.every(sq => sq.getY() === 6)).toBe(true);
            expect(card.toRequest()).toEqual({ name: "Line Scan", line: "row" });

            card.rotate();
            const column = card.previewAt(knownEnemy(), t)!.squares;
            expect(column.every(sq => sq.getX() === 3)).toBe(true);
            expect(card.toRequest()).toEqual({ name: "Line Scan", line: "column" });
        });

        it("refuses a line that's all been shot", () =>
        {
            const row0 = Array.from({ length: 10 }, (_, col) => ({ row: 0, col }));
            const card = armed(new LineScan());
            expect(card.isValidTarget(knownEnemy(row0), new Coordinate(4, 0))).toBe(false);
            card.rotate();
            expect(card.isValidTarget(knownEnemy(row0), new Coordinate(4, 0))).toBe(true);
        });
    });

    describe("Reroute", () =>
    {
        it("aims at your own board and needs a ship before any target", () =>
        {
            const { board } = loneDestroyer();
            const card = armed(new Reroute());
            expect(card.targetBoard()).toBe("own");
            expect(card.previewAt(board, new Coordinate(5, 5))).toBeNull();
            expect(card.isValidTarget(board, new Coordinate(5, 5))).toBe(false);
            expect(() => card.toRequest()).toThrow();
        });

        it("only accepts a start from validPositions, and rotating changes them", () =>
        {
            const { board, ship } = loneDestroyer();
            const card = armed(new Reroute());
            expect(card.selectShip(board, ship)).toBe(true);

            // horizontal: J1 would put the stern off the board
            expect(card.isValidTarget(board, new Coordinate(9, 0))).toBe(false);
            expect(card.isValidTarget(board, new Coordinate(8, 0))).toBe(true);
            // its own spot isn't a move
            expect(card.isValidTarget(board, new Coordinate(0, 0))).toBe(false);

            card.rotate();
            expect(card.getRerouteOrientation()).toBe(Orientation.VERTICAL);
            expect(card.isValidTarget(board, new Coordinate(9, 0))).toBe(true);
            expect(card.isValidTarget(board, new Coordinate(0, 9))).toBe(false);
            expect(card.isValidTarget(board, new Coordinate(0, 0))).toBe(true);
        });

        it("previews the ship's squares at the hovered start", () =>
        {
            const { board, ship } = loneDestroyer();
            const card = armed(new Reroute());
            card.selectShip(board, ship);
            const preview = card.previewAt(board, new Coordinate(4, 4))!;
            expect(preview.valid).toBe(true);
            expect(preview.squares.map(c => c.key())).toEqual(["4,4", "5,4"]);
        });

        it("won't select a damaged ship", () =>
        {
            const board = Board.fromSnapshot({
                ships: [{ name: "Destroyer", row: 0, col: 0, orientation: "horizontal" }],
                shots: [{ row: 0, col: 0 }]
            });
            const card = armed(new Reroute());
            expect(card.selectShip(board, board.getShips()[0])).toBe(false);
            expect(card.getSelectedShip()).toBeNull();
        });

        it("builds the request with the ship's name and orientation", () =>
        {
            const { board, ship } = loneDestroyer();
            const card = armed(new Reroute());
            card.selectShip(board, ship);
            card.rotate();
            expect(card.toRequest()).toEqual({ name: "Reroute", ship: "Destroyer", orientation: "vertical" });
        });
    });

    describe("keep or replace", () =>
    {
        it("keeping holds on to the current ability", () =>
        {
            const card = new AbilityCard();
            const current = new RadarSweep();
            card.show(current);
            card.showKeepOrReplace(current, new Reroute());
            expect(card.answerOffer(true)).toBe(true);
            expect(card.getOffer()).toBeNull();
            expect(card.getAbility()).toBe(current);
        });

        it("replacing takes the drawn ability and drops targeting", () =>
        {
            const card = armed(new RadarSweep());
            const drawn = new Reroute();
            card.showKeepOrReplace(card.getAbility()!, drawn);
            expect(card.answerOffer(false)).toBe(false);
            expect(card.getAbility()).toBe(drawn);
            expect(card.isArmed()).toBe(false);
        });
    });
});

describe("scannedSquares", () =>
{
    it("covers the on-board part of a Radar Sweep and the whole line of a Line Scan", () =>
    {
        const board = knownEnemy();
        expect(scannedSquares({ name: "Radar Sweep" }, board, new Coordinate(0, 0))).toHaveLength(9);
        expect(scannedSquares({ name: "Line Scan", line: "column" }, board, new Coordinate(2, 5)).every(c => c.getX() === 2)).toBe(true);
        expect(scannedSquares({ name: "Double Shot" }, board, new Coordinate(0, 0))).toEqual([]);
    });
});

describe("createAbility", () =>
{
    it("makes each ability from its server name, and null for anything else", () =>
    {
        expect(createAbility("Radar Sweep")).toBeInstanceOf(RadarSweep);
        expect(createAbility("Line Scan")).toBeInstanceOf(LineScan);
        expect(createAbility("Double Shot")).toBeInstanceOf(DoubleShot);
        expect(createAbility("Reroute")).toBeInstanceOf(Reroute);
        expect(createAbility("Nuke")).toBeNull();
    });
});
