import { describe, it, expect } from "vitest";
import {
    ENEMY_FLEET,
    OPPONENT_SCRIPT,
    afloatCount,
    battleReducer,
    createBattleState,
    marksFor,
    revealedEnemyShips,
    shipCells,
    shipTypeOf,
    toPlacement,
    type BattleState
} from "../../app/design/_screens/battleDemo";
import { createGameFixture } from "../../fixtures/game.fixture";

function playing(): BattleState
{
    return battleReducer(createBattleState(createGameFixture()), { type: "start" });
}

describe("battleDemo", () =>
{
    it("maps the fixture onto Board keys and marks", () =>
    {
        const state = createBattleState(createGameFixture());
        const target = marksFor(ENEMY_FLEET, state.myShots);
        expect(target).toMatchObject({ A1: "miss", H3: "hit", D7: "sunk", E7: "sunk", J10: "miss" });
        expect(marksFor(state.ownFleet, state.enemyShots)).toEqual({ C1: "hit", F6: "miss", I2: "miss" });
        expect(revealedEnemyShips(state.myShots).map((s) => s.type)).toEqual(["destroyer"]);
        expect(state.turn).toBe(7);
    });

    it("rejects unknown ship names", () =>
    {
        expect(() => shipTypeOf("Rowboat")).toThrow();
    });

    it("waits for the countdown before you can fire", () =>
    {
        const state = createBattleState(createGameFixture());
        expect(state.phase).toBe("countdown");
        expect(battleReducer(state, { type: "fire", key: "B5" })).toBe(state);
        expect(battleReducer(state, { type: "start" }).phase).toBe("you");
    });

    it("keeps the turn on a hit and passes it on a miss", () =>
    {
        const hit = battleReducer(playing(), { type: "fire", key: "H4" });
        expect(hit.phase).toBe("you");
        expect(hit.log.at(-1)).toMatchObject({ coord: "H4", result: "hit", turn: 7 });

        const miss = battleReducer(hit, { type: "fire", key: "B7" });
        expect(miss.phase).toBe("opponent");
        expect(miss.turn).toBe(8);
    });

    it("ignores a square already fired at", () =>
    {
        const state = playing();
        expect(battleReducer(state, { type: "fire", key: "A1" })).toBe(state);
    });

    it("raises a sunk notice when you finish a ship", () =>
    {
        const keys = ["A3", "A4", "A5"];
        const state = keys.reduce((s, key) => battleReducer(s, { type: "fire", key }), playing());
        expect(state.sunkNotice).toEqual({ by: "you", ship: "cruiser" });
        expect(state.log.at(-1)).toMatchObject({ result: "sunk", ship: "cruiser" });
        expect(afloatCount(ENEMY_FLEET, state.myShots)).toBe(3);
    });

    it("plays Teddy's script: a miss, then sinks your Destroyer", () =>
    {
        let state = battleReducer(playing(), { type: "fire", key: "B7" });
        state = battleReducer(state, { type: "opponentFire" });
        expect(state.log.at(-1)).toMatchObject({ by: "opponent", coord: "F4", result: "miss" });
        expect(state.phase).toBe("you");

        state = battleReducer(state, { type: "fire", key: "C7" });
        state = battleReducer(state, { type: "opponentFire" });
        state = battleReducer(state, { type: "opponentFire" });
        expect(state.sunkNotice).toEqual({ by: "opponent", ship: "destroyer" });
        expect(state.phase).toBe("opponent");
    });

    it("ends the game when a fleet is gone", () =>
    {
        // squares already hit are ignored as repeats, so firing at every ship square is enough
        const state = ENEMY_FLEET.flatMap(shipCells).reduce((s, key) => battleReducer(s, { type: "fire", key }), playing());
        expect(state.phase).toBe("over");
        expect(state.winner).toBe("you");
    });

    it("gives each ship intact, damaged or sunk status", () =>
    {
        const destroyer = ENEMY_FLEET.find((ship) => ship.type === "destroyer")!;
        expect(toPlacement(destroyer, []).status).toBe("intact");
        expect(toPlacement(destroyer, ["D7"]).status).toBe("damaged");
        expect(toPlacement(destroyer, ["D7", "E7"])).toMatchObject({ status: "sunk", orientation: "horizontal" });
    });

    it("skips scripted squares already fired at", () =>
    {
        const state: BattleState = { ...playing(), phase: "opponent", enemyShots: ["C1", "F6", "I2", "F4"] };
        const next = battleReducer(state, { type: "opponentFire" });
        expect(next.log.at(-1)).toMatchObject({ by: "opponent", coord: "A9", result: "hit" });
    });

    it("falls back to the first open square once the script runs out", () =>
    {
        const state: BattleState = { ...playing(), phase: "opponent", scriptIndex: OPPONENT_SCRIPT.length };
        const next = battleReducer(state, { type: "opponentFire" });
        expect(next.log.at(-1)).toMatchObject({ by: "opponent", coord: "A1", result: "hit" });
    });

    it("lets Teddy win when your last ship goes down", () =>
    {
        const start = playing();
        const allButLast = start.ownFleet.flatMap(shipCells).filter((key) => key !== "A10");
        const state: BattleState = {
            ...start,
            phase: "opponent",
            enemyShots: allButLast,
            scriptIndex: OPPONENT_SCRIPT.indexOf("A10")
        };
        const next = battleReducer(state, { type: "opponentFire" });
        expect(next.phase).toBe("over");
        expect(next.winner).toBe("opponent");
    });

    it("ignores start once the game is running, and Teddy firing on your turn", () =>
    {
        const state = playing();
        expect(battleReducer(state, { type: "start" })).toBe(state);
        expect(battleReducer(state, { type: "opponentFire" })).toBe(state);
    });

    it("dismissNotice clears the sunk notice", () =>
    {
        const sunk = ["A3", "A4", "A5"].reduce((s, key) => battleReducer(s, { type: "fire", key }), playing());
        expect(sunk.sunkNotice).not.toBeNull();
        expect(battleReducer(sunk, { type: "dismissNotice" }).sunkNotice).toBeNull();
    });
});
