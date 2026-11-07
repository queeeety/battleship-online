import { describe, it, expect } from "vitest";
import { soundForUpdate, type SoundState } from "../../lib/audio/soundForUpdate";
import type { ShotView } from "../../lib/controllers/Server";
import { ShotResult } from "../../lib/enums";

function shot(row: number, col: number, result: ShotResult): ShotView
{
    return { row, col, result, sunkShipName: result === ShotResult.SUNK ? "Destroyer" : null };
}

function state(parts: Partial<SoundState> = {}): SoundState
{
    return { yourShots: [], opponentShots: [], yourTurn: false, ...parts };
}

function ended(won: boolean): SoundState["result"]
{
    return { won, shotsFired: 20, accuracy: 0.5, shipsSunk: won ? 5 : 2 };
}

describe("soundForUpdate", () =>
{
    it("is silent on first load, even with old shots and my turn", () =>
    {
        const next = state({
            yourShots: [shot(0, 0, ShotResult.SUNK)],
            opponentShots: [shot(1, 1, ShotResult.HIT)],
            yourTurn: true
        });
        expect(soundForUpdate(null, next)).toBeNull();
    });

    it.each([
        [ShotResult.MISS, "miss"],
        [ShotResult.HIT, "hit"],
        [ShotResult.SUNK, "sunk"]
    ] as const)("plays the right sound for one new shot of mine (%s)", (result, sound) =>
    {
        const prev = state({ yourTurn: true });
        const next = state({ yourShots: [shot(2, 3, result)] });
        expect(soundForUpdate(prev, next)).toBe(sound);
    });

    it("plays a sound for a new opponent shot too", () =>
    {
        const next = state({ opponentShots: [shot(4, 4, ShotResult.HIT)] });
        expect(soundForUpdate(state(), next)).toBe("hit");
    });

    it("plays only the top sound when several shots are new", () =>
    {
        const next = state({
            yourShots: [shot(0, 0, ShotResult.MISS), shot(0, 1, ShotResult.SUNK)],
            opponentShots: [shot(5, 5, ShotResult.HIT)]
        });
        expect(soundForUpdate(state(), next)).toBe("sunk");

        const noSunk = state({
            yourShots: [shot(0, 0, ShotResult.MISS)],
            opponentShots: [shot(5, 5, ShotResult.HIT)]
        });
        expect(soundForUpdate(state(), noSunk)).toBe("hit");
    });

    it("ignores old shots and only counts the new square", () =>
    {
        const prev = state({ yourShots: [shot(0, 0, ShotResult.SUNK)] });
        const next = state({ yourShots: [shot(0, 0, ShotResult.SUNK), shot(9, 9, ShotResult.MISS)] });
        expect(soundForUpdate(prev, next)).toBe("miss");
    });

    it("treats the same square on the other board as a new shot", () =>
    {
        const prev = state({ yourShots: [shot(3, 3, ShotResult.MISS)] });
        const next = state({
            yourShots: [shot(3, 3, ShotResult.MISS)],
            opponentShots: [shot(3, 3, ShotResult.HIT)]
        });
        expect(soundForUpdate(prev, next)).toBe("hit");
    });

    it("is silent when a re-fetch brings the same shots in a new order", () =>
    {
        const a = shot(0, 0, ShotResult.HIT);
        const b = shot(1, 2, ShotResult.MISS);
        const c = shot(7, 7, ShotResult.SUNK);
        const prev = state({ yourShots: [a, b], opponentShots: [c], yourTurn: true });
        const next = state({ yourShots: [b, a], opponentShots: [c], yourTurn: true });
        expect(soundForUpdate(prev, next)).toBeNull();
    });

    it("plays turn when it becomes my turn with no new shot", () =>
    {
        expect(soundForUpdate(state({ yourTurn: false }), state({ yourTurn: true }))).toBe("turn");
    });

    it.each([
        [true, true],
        [true, false],
        [false, false]
    ])("is silent when yourTurn goes %s -> %s with no new shot", (before, after) =>
    {
        expect(soundForUpdate(state({ yourTurn: before }), state({ yourTurn: after }))).toBeNull();
    });

    it("plays the shot, not turn, when both happen in one update", () =>
    {
        const prev = state({ yourTurn: false });
        const next = state({ opponentShots: [shot(6, 2, ShotResult.MISS)], yourTurn: true });
        expect(soundForUpdate(prev, next)).toBe("miss");
    });

    it.each([
        [true, "win"],
        [false, "lose"]
    ] as const)("plays %s on the update that ends the game, over the last shot", (won, sound) =>
    {
        const prev = state({ yourTurn: true, result: null });
        const next = state({ yourShots: [shot(8, 8, ShotResult.SUNK)], result: ended(won) });
        expect(soundForUpdate(prev, next)).toBe(sound);
    });

    it("plays the end sound for a game that ends without a shot (forfeit or timeout)", () =>
    {
        expect(soundForUpdate(state({ result: null }), state({ result: ended(true) }))).toBe("win");
    });

    it("is silent when a finished game re-sends its result", () =>
    {
        expect(soundForUpdate(state({ result: ended(false) }), state({ result: ended(false) }))).toBeNull();
    });

    it("is silent when a finished game is reloaded", () =>
    {
        expect(soundForUpdate(null, state({ result: ended(true) }))).toBeNull();
    });
});
