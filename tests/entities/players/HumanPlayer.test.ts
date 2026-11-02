import { describe, it, expect } from "vitest";
import { HumanPlayer } from "../../../lib/entities/players";
import { DISCONNECT_GRACE_PERIOD_MS } from "../../../lib/config";

describe("HumanPlayer", () =>
{
    it("keeps the sessionId it was seated with", () =>
    {
        expect(new HumanPlayer("Cian91", "session-1").getSessionId()).toBe("session-1");
    });

    it("never picks its own target, the click does", () =>
    {
        expect(() => new HumanPlayer("Cian91", "s").chooseTarget()).toThrow();
    });

    it("starts connected with no forfeit clock running", () =>
    {
        const p = new HumanPlayer("Cian91", "s");
        expect(p.isConnected()).toBe(true);
        expect(p.getDisconnectedAt()).toBeNull();
        expect(p.hasExceededGracePeriod()).toBe(false);
    });

    it("is within the grace period just before the limit and past it just after", () =>
    {
        const p = new HumanPlayer("Cian91", "s");
        const left = new Date("2026-11-02T12:00:00Z");
        p.disconnect(left);

        expect(p.isConnected()).toBe(false);
        expect(p.hasExceededGracePeriod(new Date(left.getTime() + DISCONNECT_GRACE_PERIOD_MS))).toBe(false);
        expect(p.hasExceededGracePeriod(new Date(left.getTime() + DISCONNECT_GRACE_PERIOD_MS + 1))).toBe(true);
    });

    it("stops the forfeit clock on reconnect", () =>
    {
        const p = new HumanPlayer("Cian91", "s");
        p.disconnect(new Date("2026-11-02T12:00:00Z"));
        p.reconnect();
        expect(p.isConnected()).toBe(true);
        expect(p.getDisconnectedAt()).toBeNull();
        expect(p.hasExceededGracePeriod(new Date("2026-11-02T13:00:00Z"))).toBe(false);
    });
});
