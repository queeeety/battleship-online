import { describe, it, expect } from "vitest";
import { DoubleShot } from "../../lib/abilities";
import { Coordinate } from "../../lib/entities/board";
import { Game } from "../../lib/controllers/Game";
import { GameType } from "../../lib/enums";
import { OPEN_WATER, startedGame } from "../helpers";

describe("DoubleShot", () =>
{
    it("doesn't use the turn's shot and needs no target", () =>
    {
        const ds = new DoubleShot();
        const { first } = startedGame();
        expect(ds.getUsesTurnShot()).toBe(false);
        expect(ds.isValidTarget(first.getBoard(), new Coordinate(0, 0))).toBe(true);
    });

    it("can't be used before the battle starts", () =>
    {
        expect(new DoubleShot().canUse(new Game(GameType.ORIGINAL))).toBe(false);
    });

    it("can't be used while another Double Shot is still active", () =>
    {
        const { game } = startedGame();
        game.setDoubleShotActive(true);
        expect(new DoubleShot().canUse(game)).toBe(false);
    });

    it("through Game: keeps the turn, then the first miss is absorbed and the second passes the turn", () =>
    {
        const { game, first, second } = startedGame();
        first.receiveAbility(new DoubleShot());

        game.applyAbility(first, new Coordinate(0, 0));
        expect(game.isDoubleShotActive()).toBe(true);
        expect(game.getCurrentTurn()).toBe(first);
        expect(first.getHeldAbility()).toBeNull();

        game.fireShot(first, OPEN_WATER);
        expect(game.getCurrentTurn()).toBe(first);
        expect(game.isDoubleShotActive()).toBe(false);

        game.fireShot(first, new Coordinate(8, 8));
        expect(game.getCurrentTurn()).toBe(second);
    });

    it("can only be used once", () =>
    {
        const { game, first } = startedGame();
        const ds = new DoubleShot();
        ds.apply(game, first.getBoard(), new Coordinate(0, 0));
        game.setDoubleShotActive(false);
        expect(ds.canUse(game)).toBe(false);
    });
});
