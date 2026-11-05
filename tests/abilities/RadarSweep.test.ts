import { describe, it, expect } from "vitest";
import { RadarSweep } from "../../lib/abilities";
import { Board, Coordinate } from "../../lib/entities/board";
import { HumanPlayer } from "../../lib/entities/players";
import { placeKnownFleet, startedGame } from "../helpers";

const keys = (squares: Coordinate[]) => squares.map(c => c.key()).sort();

describe("RadarSweep", () =>
{
    it("uses the turn's shot", () =>
    {
        expect(new RadarSweep().getUsesTurnShot()).toBe(true);
    });

    it("accepts any corner whose 3x3 area stays on the board", () =>
    {
        const radar = new RadarSweep();
        const board = new Board();
        expect(radar.isValidTarget(board, new Coordinate(0, 0))).toBe(true);
        expect(radar.isValidTarget(board, new Coordinate(7, 7))).toBe(true);
    });

    it("rejects a corner whose area would go past the edge", () =>
    {
        const radar = new RadarSweep();
        const board = new Board();
        expect(radar.isValidTarget(board, new Coordinate(8, 0))).toBe(false);
        expect(radar.isValidTarget(board, new Coordinate(0, 8))).toBe(false);
        expect(radar.isValidTarget(board, new Coordinate(-1, 0))).toBe(false);
    });

    it("rejects an area where every square has already been shot", () =>
    {
        const radar = new RadarSweep();
        const board = new Board();
        const shooter = new HumanPlayer("Aoife", "s");
        for (const sq of RadarSweep.areaFrom(new Coordinate(4, 4))) board.receiveShot(sq, shooter);
        expect(radar.isValidTarget(board, new Coordinate(4, 4))).toBe(false);
        expect(radar.isValidTarget(board, new Coordinate(3, 3))).toBe(true);
    });

    it("reveals only the unshot ship squares in the area", () =>
    {
        const { game } = startedGame();
        const board = placeKnownFleet();
        board.receiveShot(new Coordinate(0, 0), new HumanPlayer("Aoife", "s"));
        const radar = new RadarSweep();

        radar.apply(game, board, new Coordinate(0, 0));
        // rows 1 and 3 of the known fleet fill columns A-C, minus the square already hit
        expect(keys(radar.getRevealed())).toEqual(keys(RadarSweep.areaFrom(new Coordinate(0, 0))
            .filter(c => c.getY() !== 1 && !c.equals(new Coordinate(0, 0)))));
    });

    it("reveals nothing over open water", () =>
    {
        const { game } = startedGame();
        const radar = new RadarSweep();
        radar.apply(game, placeKnownFleet(), new Coordinate(7, 7));
        expect(radar.getRevealed()).toEqual([]);
    });

    it("can only be used once", () =>
    {
        const { game } = startedGame();
        const radar = new RadarSweep();
        expect(radar.canUse(game)).toBe(true);
        radar.apply(game, placeKnownFleet(), new Coordinate(0, 0));
        expect(radar.canUse(game)).toBe(false);
    });

    it("through Game: reveals squares on the opponent's board and passes the turn", () =>
    {
        const { game, first, second } = startedGame();
        const radar = new RadarSweep();
        first.receiveAbility(radar);

        game.applyAbility(first, new Coordinate(0, 6));
        // Submarine A7-C7 and Destroyer A9-B9 in the known fleet
        expect(radar.getRevealed()).toHaveLength(5);
        expect(first.getHeldAbility()).toBeNull();
        expect(game.getCurrentTurn()).toBe(second);
    });

    it("through Game: an off-board corner is rejected and the ability kept", () =>
    {
        const { game, first } = startedGame();
        const radar = new RadarSweep();
        first.receiveAbility(radar);
        expect(() => game.applyAbility(first, new Coordinate(9, 9))).toThrow();
        expect(first.getHeldAbility()).toBe(radar);
        expect(game.getCurrentTurn()).toBe(first);
    });
});
