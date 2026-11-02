import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Timer } from "../../lib/boundary/Timer";

describe("Timer", () =>
{
    // fake clock so Date.now() only moves when the test says so
    beforeEach(() =>
    {
        vi.useFakeTimers();
    });

    afterEach(() =>
    {
        vi.useRealTimers();
    });

    it("reads 0 and not expired before it starts", () =>
    {
        const timer = new Timer();
        expect(timer.secondsLeft()).toBe(0);
        expect(timer.hasExpired()).toBe(false);
    });

    it("counts down from the limit", () =>
    {
        const timer = new Timer();
        timer.start(3000);
        expect(timer.secondsLeft()).toBe(3);

        vi.advanceTimersByTime(1500);
        expect(timer.secondsLeft()).toBe(1.5);
        expect(timer.hasExpired()).toBe(false);
    });

    it("expires at the limit and never goes below 0", () =>
    {
        const timer = new Timer();
        timer.start(3000);

        vi.advanceTimersByTime(3000);
        expect(timer.secondsLeft()).toBe(0);
        expect(timer.hasExpired()).toBe(true);

        vi.advanceTimersByTime(5000);
        expect(timer.secondsLeft()).toBe(0);
    });

    it("stop() resets it to not running", () =>
    {
        const timer = new Timer();
        timer.start(3000);
        vi.advanceTimersByTime(4000);
        timer.stop();
        expect(timer.secondsLeft()).toBe(0);
        expect(timer.hasExpired()).toBe(false);
    });

    it("start() again restarts the countdown", () =>
    {
        const timer = new Timer();
        timer.start(3000);
        vi.advanceTimersByTime(2000);
        timer.start(5000);
        expect(timer.secondsLeft()).toBe(5);
    });
});
