import { describe, it, expect } from "vitest";
import { secondsLeft } from "../../components/screens/turnClock";

const start = "2026-11-04T12:00:00.000Z";
const at = (s: number) => Date.parse(start) + s * 1000;

describe("secondsLeft", () =>
{
    it("shows a full turn before the battle starts", () =>
    {
        expect(secondsLeft({ total: 15, turnStartedAt: null, now: at(100) })).toBe(15);
    });

    it("counts down from the turn's start, rounding up", () =>
    {
        expect(secondsLeft({ total: 15, turnStartedAt: start, now: at(0) })).toBe(15);
        expect(secondsLeft({ total: 15, turnStartedAt: start, now: at(4.2) })).toBe(11);
        expect(secondsLeft({ total: 15, turnStartedAt: start, now: at(15) })).toBe(0);
    });

    it("never goes below 0 or above a full turn when the clocks disagree", () =>
    {
        expect(secondsLeft({ total: 5, turnStartedAt: start, now: at(40) })).toBe(0);
        expect(secondsLeft({ total: 5, turnStartedAt: start, now: at(-3) })).toBe(5);
    });

    it("freezes at the moment the mover dropped out", () =>
    {
        expect(secondsLeft({ total: 15, turnStartedAt: start, now: at(50), pausedAt: new Date(at(6)).toISOString() })).toBe(9);
    });
});
