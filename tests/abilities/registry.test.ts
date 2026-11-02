import { describe, it, expect, vi, afterEach } from "vitest";
import { ABILITY_FACTORIES, drawRandomAbility } from "../../lib/abilities/registry";
import { DoubleShot, RadarSweep, LineScan, Reroute } from "../../lib/abilities";
import { GameState } from "../../lib/enums";
import { gameWithAiToMove } from "../helpers";

afterEach(() => vi.restoreAllMocks());

describe("ability registry", () =>
{
    it("lists the four abilities", () =>
    {
        expect(ABILITY_FACTORIES.map(make => make().getName()))
            .toEqual(["Double Shot", "Radar Sweep", "Line Scan", "Reroute"]);
    });

    it("drawRandomAbility can draw each of the four", () =>
    {
        const draws = [0, 0.25, 0.5, 0.99].map(r =>
        {
            vi.spyOn(Math, "random").mockReturnValueOnce(r);
            return drawRandomAbility();
        });
        expect(draws[0]).toBeInstanceOf(DoubleShot);
        expect(draws[1]).toBeInstanceOf(RadarSweep);
        expect(draws[2]).toBeInstanceOf(LineScan);
        expect(draws[3]).toBeInstanceOf(Reroute);
    });

    it("drawRandomAbility gives a fresh ability every draw", () =>
    {
        vi.spyOn(Math, "random").mockReturnValue(0);
        expect(drawRandomAbility()).not.toBe(drawRandomAbility());
    });

    it("drawRandomAbility never draws an excluded ability (200 draws)", () =>
    {
        for (let i = 0; i < 200; i++) expect(drawRandomAbility(["Reroute"])).not.toBeInstanceOf(Reroute);
    });

    it("drawRandomAbility still picks fairly from what's left after excluding", () =>
    {
        vi.spyOn(Math, "random").mockReturnValue(0.99);
        expect(drawRandomAbility(["Reroute"])).toBeInstanceOf(LineScan);
    });

    it("drawRandomAbility ignores names that aren't abilities", () =>
    {
        vi.spyOn(Math, "random").mockReturnValue(0.99);
        expect(drawRandomAbility(["Nuke"])).toBeInstanceOf(Reroute);
    });

    it("drawRandomAbility throws when every ability is excluded", () =>
    {
        expect(() => drawRandomAbility(["Double Shot", "Radar Sweep", "Line Scan", "Reroute"])).toThrow();
    });

    it("a whole game with real draws gets past every sunk ship to a winner", () =>
    {
        const { game, ai, human } = gameWithAiToMove();
        let guard = 0;
        while (game.getState() === GameState.IN_PROGRESS && guard++ < 300)
        {
            if (game.getCurrentTurn() === ai) ai.takeTurn(game);
            else game.fireRandomShot(human);
        }
        expect(game.getState()).toBe(GameState.FINISHED);
        // the loser saw ships sink along the way, so it was granted something
        const loser = game.opponentOf(game.getWinner()!);
        expect(game.resultFor(game.getWinner()!).getShipsSunk()).toBe(5);
        expect(loser.getHeldAbility()).toBeNull();   // cleared when the game ended
    });
});
