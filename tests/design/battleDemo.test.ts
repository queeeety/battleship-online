import { describe, it, expect } from "vitest";
import {
    ENEMY_FLEET,
    OPPONENT_SCRIPT,
    afloatCount,
    battleReducer,
    createBattleState,
    marksFor,
    openSquares,
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

    it("openSquares lists every square not yet fired at, row by row", () =>
    {
        expect(openSquares([])).toHaveLength(100);
        const open = openSquares(["A1", "B1"]);
        expect(open).toHaveLength(98);
        expect(open[0]).toBe("C1");
        expect(open).not.toContain("A1");
    });

    it("timeout fires the given square for you, with the normal turn rules", () =>
    {
        const hit = battleReducer(playing(), { type: "timeout", key: "H4" });
        expect(hit.log.at(-1)).toMatchObject({ by: "you", coord: "H4", result: "hit" });
        expect(hit.phase).toBe("you");

        const miss = battleReducer(hit, { type: "timeout", key: "B7" });
        expect(miss.phase).toBe("opponent");
    });

    it("ignores a timeout during the countdown and on Teddy's turn", () =>
    {
        const countdown = createBattleState(createGameFixture());
        expect(battleReducer(countdown, { type: "timeout", key: "B7" })).toBe(countdown);

        const teddys = battleReducer(playing(), { type: "fire", key: "B7" });
        expect(battleReducer(teddys, { type: "timeout", key: "C7" })).toBe(teddys);
    });

    describe("abilities", () =>
    {
        const holding = (name: string | null): BattleState => ({ ...playing(), heldAbility: name });

        it("starts holding Line Scan with nothing revealed", () =>
        {
            const state = playing();
            expect(state.heldAbility).toBe("Line Scan");
            expect(state.offeredAbility).toBeNull();
            expect(state.revealed).toEqual([]);
        });

        it("Line Scan reveals the unshot ship squares in the row and passes the turn", () =>
        {
            const before = playing();
            const after = battleReducer(before, { type: "useAbility", request: { name: "Line Scan", line: "row" }, target: "B10" });
            expect(after.revealed).toEqual(["B10", "C10", "D10", "E10", "F10"]);
            expect(after.heldAbility).toBeNull();
            expect(after.phase).toBe("opponent");
            expect(after.turn).toBe(before.turn + 1);
            expect(after.log.at(-1)).toMatchObject({ by: "you", ability: "line-scan", coord: "B10", note: "5 contacts" });
        });

        it("Radar Sweep skips squares already shot and refuses an area off the board", () =>
        {
            const state = holding("Radar Sweep");
            const swept = battleReducer(state, { type: "useAbility", request: { name: "Radar Sweep" }, target: "G1" });
            expect(swept.revealed).toEqual(["H2"]);
            expect(battleReducer(state, { type: "useAbility", request: { name: "Radar Sweep" }, target: "I1" })).toBe(state);
        });

        it("refuses an ability you don't hold, or one used off your turn", () =>
        {
            const state = playing();
            expect(battleReducer(state, { type: "useAbility", request: { name: "Radar Sweep" }, target: "G1" })).toBe(state);
            const waiting = { ...state, phase: "opponent" as const };
            expect(battleReducer(waiting, { type: "useAbility", request: { name: "Line Scan", line: "row" }, target: "B10" })).toBe(waiting);
        });

        it("Reroute moves an undamaged ship but not a damaged one", () =>
        {
            const state = holding("Reroute");
            const moved = battleReducer(state, { type: "useAbility", request: { name: "Reroute", ship: "Destroyer", orientation: "horizontal" }, target: "G4" });
            expect(moved.ownFleet.find((s) => s.type === "destroyer")).toMatchObject({ x: 6, y: 3, horizontal: true });
            expect(moved.phase).toBe("opponent");
            // the Carrier was hit at C1
            expect(battleReducer(state, { type: "useAbility", request: { name: "Reroute", ship: "Carrier", orientation: "horizontal" }, target: "A7" })).toBe(state);
        });

        it("Double Shot keeps the turn after one miss, then a miss passes it", () =>
        {
            const armed = battleReducer(holding("Double Shot"), { type: "useAbility", request: { name: "Double Shot" } });
            expect(armed.doubleShotActive).toBe(true);
            expect(armed.phase).toBe("you");
            const firstMiss = battleReducer(armed, { type: "fire", key: "J1" });
            expect(firstMiss.phase).toBe("you");
            expect(firstMiss.doubleShotActive).toBe(false);
            expect(battleReducer(firstMiss, { type: "fire", key: "J2" }).phase).toBe("opponent");
        });

        it("losing a ship draws an ability, offered as keep-or-replace when you hold one", () =>
        {
            // Teddy's next scripted shot, A10, sinks your Destroyer
            const aboutToSink = (held: string | null): BattleState =>
                ({ ...playing(), phase: "opponent", scriptIndex: 2, enemyShots: [...playing().enemyShots, "A9"], heldAbility: held });
            expect(battleReducer(aboutToSink(null), { type: "opponentFire", draw: "Reroute" }).heldAbility).toBe("Reroute");
            const offered = battleReducer(aboutToSink("Line Scan"), { type: "opponentFire", draw: "Reroute" });
            expect(offered).toMatchObject({ heldAbility: "Line Scan", offeredAbility: "Reroute" });

            expect(battleReducer(offered, { type: "chooseAbility", keep: true })).toMatchObject({ heldAbility: "Line Scan", offeredAbility: null });
            expect(battleReducer(offered, { type: "chooseAbility", keep: false })).toMatchObject({ heldAbility: "Reroute", offeredAbility: null });
        });
    });
});
