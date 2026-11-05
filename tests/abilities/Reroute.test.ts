import { describe, it, expect, vi, afterEach } from "vitest";
import { Reroute } from "../../lib/abilities";
import { Board, Coordinate } from "../../lib/entities/board";
import { HumanPlayer } from "../../lib/entities/players";
import { Destroyer } from "../../lib/entities/ships";
import type { Ship } from "../../lib/entities/ships";
import { Orientation } from "../../lib/enums";
import { placeKnownFleet, startedGame } from "../helpers";

afterEach(() => vi.restoreAllMocks());

const shooter = new HumanPlayer("Cian", "s");
const destroyerOf = (b: Board) => b.getShips().find(s => s.getName() === "Destroyer")!;
const has = (squares: Coordinate[], c: Coordinate) => squares.some(sq => sq.equals(c));

// a board with just a Destroyer at A1-B1
function loneDestroyer(): { board: Board; ship: Ship }
{
    const board = new Board();
    const ship = new Destroyer();
    board.placeShip(ship, new Coordinate(0, 0), Orientation.HORIZONTAL);
    return { board, ship };
}

describe("Reroute", () =>
{
    it("uses the turn's shot", () =>
    {
        expect(new Reroute().getUsesTurnShot()).toBe(true);
    });

    it("validPositions lists every spot on an empty board except where the ship already is", () =>
    {
        const { board, ship } = loneDestroyer();
        // a length 2 ship has 9 starts per row across 10 rows, minus its own spot
        expect(new Reroute().validPositions(board, ship, Orientation.HORIZONTAL)).toHaveLength(89);
        expect(new Reroute().validPositions(board, ship, Orientation.VERTICAL)).toHaveLength(90);
    });

    it("validPositions lets the ship overlap its own old squares", () =>
    {
        const { board, ship } = loneDestroyer();
        expect(has(new Reroute().validPositions(board, ship), new Coordinate(1, 0))).toBe(true);
    });

    it("validPositions never covers a square the opponent fired at, hit or miss", () =>
    {
        const { board, ship } = loneDestroyer();
        board.receiveShot(new Coordinate(5, 5), shooter);
        const options = new Reroute().validPositions(board, ship);
        expect(has(options, new Coordinate(4, 5))).toBe(false);
        expect(has(options, new Coordinate(5, 5))).toBe(false);
        expect(has(options, new Coordinate(6, 5))).toBe(true);
    });

    it("validPositions never overlaps another ship", () =>
    {
        const board = placeKnownFleet();
        const options = new Reroute().validPositions(board, destroyerOf(board));
        // the Carrier fills A1-E1, and F1 has to stay free next to it
        expect(has(options, new Coordinate(0, 0))).toBe(false);
        expect(has(options, new Coordinate(3, 0))).toBe(false);
        expect(has(options, new Coordinate(5, 0))).toBe(false);
        expect(has(options, new Coordinate(6, 0))).toBe(true);
    });

    it("validPositions is empty for a damaged ship or one not on the board", () =>
    {
        const { board, ship } = loneDestroyer();
        expect(new Reroute().validPositions(new Board(), ship)).toEqual([]);
        board.receiveShot(new Coordinate(0, 0), shooter);
        expect(new Reroute().validPositions(board, ship)).toEqual([]);
    });

    it("validPositions uses the chosen orientation by default", () =>
    {
        const { board, ship } = loneDestroyer();
        const reroute = new Reroute();
        reroute.setOrientation(Orientation.VERTICAL);
        expect(has(reroute.validPositions(board, ship), new Coordinate(0, 8))).toBe(true);
        expect(has(reroute.validPositions(board, ship), new Coordinate(0, 9))).toBe(false);
    });

    it("canMove checks both orientations", () =>
    {
        // every column but A has been shot, so the ship can only move up and down column A
        const board = new Board();
        const ship = new Destroyer();
        board.placeShip(ship, new Coordinate(0, 0), Orientation.VERTICAL);
        for (let y = 0; y < 10; y++) for (let x = 1; x < 10; x++) board.receiveShot(new Coordinate(x, y), shooter);
        const reroute = new Reroute();
        expect(reroute.validPositions(board, ship, Orientation.HORIZONTAL)).toEqual([]);
        expect(reroute.canMove(board, ship)).toBe(true);
    });

    it("isValidTarget needs a selected ship and a valid start", () =>
    {
        const { board, ship } = loneDestroyer();
        const reroute = new Reroute();
        expect(reroute.isValidTarget(board, new Coordinate(5, 5))).toBe(false);
        reroute.selectShip(ship);
        expect(reroute.isValidTarget(board, new Coordinate(5, 5))).toBe(true);
        expect(reroute.isValidTarget(board, new Coordinate(9, 5))).toBe(false);   // runs off the edge
    });

    it("apply moves the ship", () =>
    {
        const { game } = startedGame();
        const { board, ship } = loneDestroyer();
        const reroute = new Reroute();
        reroute.selectShip(ship);
        reroute.setOrientation(Orientation.VERTICAL);

        reroute.apply(game, board, new Coordinate(6, 2));
        expect(ship.getStart()!.equals(new Coordinate(6, 2))).toBe(true);
        expect(ship.getOrientation()).toBe(Orientation.VERTICAL);
        expect(board.getCell(new Coordinate(0, 0)).getShip()).toBeNull();
        expect(board.getCell(new Coordinate(6, 3)).getShip()).toBe(ship);
    });

    it("through Game: moves the player's own ship and passes the turn", () =>
    {
        const { game, first, second } = startedGame();
        const reroute = new Reroute();
        first.receiveAbility(reroute);
        const ship = destroyerOf(first.getBoard());
        reroute.selectShip(ship);

        game.applyAbility(first, new Coordinate(7, 9));
        expect(ship.getStart()!.equals(new Coordinate(7, 9))).toBe(true);
        expect(game.getCurrentTurn()).toBe(second);
    });

    it("through Game: a spot over an old miss is rejected and the ability kept", () =>
    {
        const { game, first, second } = startedGame();
        const reroute = new Reroute();
        second.receiveAbility(reroute);
        game.fireShot(first, new Coordinate(8, 9));   // a miss, passes the turn to second
        reroute.selectShip(destroyerOf(second.getBoard()));

        expect(() => game.applyAbility(second, new Coordinate(7, 9))).toThrow();
        expect(second.getHeldAbility()).toBe(reroute);
        expect(game.getCurrentTurn()).toBe(second);
    });

    it("through Game: a real Reroute draw is kept when a ship can move", () =>
    {
        const { game, second } = startedGame();
        vi.spyOn(Math, "random").mockReturnValueOnce(0.99);   // Reroute is last in the registry
        game.grantAbility(second);
        expect(second.getHeldAbility()).toBeInstanceOf(Reroute);
    });
});
