import { describe, it, expect } from "vitest";
import { LineScan } from "../../lib/abilities";
import { Board, Coordinate } from "../../lib/entities/board";
import { HumanPlayer } from "../../lib/entities/players";
import { placeKnownFleet, startedGame } from "../helpers";

const keys = (squares: Coordinate[]) => squares.map(c => c.key()).sort();

describe("LineScan", () =>
{
    it("uses the turn's shot and scans rows by default", () =>
    {
        const scan = new LineScan();
        expect(scan.getUsesTurnShot()).toBe(true);
        expect(scan.getIsRow()).toBe(true);
    });

    it("a row scan reveals the unshot ship squares in the target's row", () =>
    {
        const { game } = startedGame();
        const board = placeKnownFleet();
        board.receiveShot(new Coordinate(1, 2), new HumanPlayer("Aoife", "s"));
        const scan = new LineScan();

        scan.apply(game, board, new Coordinate(5, 2));   // the x is ignored for a row
        // Battleship A2-D2, minus B2 which was hit
        expect(keys(scan.getRevealed())).toEqual(keys([new Coordinate(0, 2), new Coordinate(2, 2), new Coordinate(3, 2)]));
    });

    it("a column scan reveals the unshot ship squares in the target's column", () =>
    {
        const { game } = startedGame();
        const scan = new LineScan();
        scan.setDirection(false);

        scan.apply(game, placeKnownFleet(), new Coordinate(2, 9));   // the y is ignored for a column
        // column C crosses the Carrier, Battleship, Cruiser and Submarine
        expect(keys(scan.getRevealed())).toEqual(keys([0, 2, 4, 6].map(y => new Coordinate(2, y))));
    });

    it("lineThrough lists the whole row or column", () =>
    {
        const scan = new LineScan();
        const board = new Board();
        expect(scan.lineThrough(board, new Coordinate(3, 6)).every(c => c.getY() === 6)).toBe(true);
        scan.setDirection(false);
        const column = scan.lineThrough(board, new Coordinate(3, 6));
        expect(column).toHaveLength(10);
        expect(column.every(c => c.getX() === 3)).toBe(true);
    });

    it("rejects a target off the board", () =>
    {
        const scan = new LineScan();
        expect(scan.isValidTarget(new Board(), new Coordinate(0, 10))).toBe(false);
        expect(scan.isValidTarget(new Board(), new Coordinate(-1, 0))).toBe(false);
    });

    it("rejects a line where every square has already been shot", () =>
    {
        const scan = new LineScan();
        const board = new Board();
        const shooter = new HumanPlayer("Aoife", "s");
        for (let x = 0; x < 10; x++) board.receiveShot(new Coordinate(x, 4), shooter);
        expect(scan.isValidTarget(board, new Coordinate(0, 4))).toBe(false);
        // the columns through row 5 still have other squares to scan
        scan.setDirection(false);
        expect(scan.isValidTarget(board, new Coordinate(0, 4))).toBe(true);
    });

    it("through Game: scans the opponent's board and passes the turn", () =>
    {
        const { game, first, second } = startedGame();
        const scan = new LineScan();
        first.receiveAbility(scan);

        game.applyAbility(first, new Coordinate(0, 0));
        expect(scan.getRevealed()).toHaveLength(5);   // the Carrier
        expect(game.getCurrentTurn()).toBe(second);
    });
});
