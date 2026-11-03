import { describe, it, expect } from "vitest";
import { HumanPlayer } from "../../../lib/entities/players";
import { RematchStatus } from "../../../lib/enums";

describe("RematchRequest", () =>
{
    const asked = () => new HumanPlayer("Cian", "a").requestRematch();

    it("starts as requested by the player who asked", () =>
    {
        const r = asked();
        expect(r.getStatus()).toBe(RematchStatus.REQUESTED);
        expect(r.getRequestedBy().getName()).toBe("Cian");
        expect(r.isMutual()).toBe(false);
    });

    it("is mutual once accepted", () =>
    {
        const r = asked();
        r.accept();
        expect(r.getStatus()).toBe(RematchStatus.ACCEPTED);
        expect(r.isMutual()).toBe(true);
    });

    it("isn't mutual once declined", () =>
    {
        const r = asked();
        r.decline();
        expect(r.getStatus()).toBe(RematchStatus.DECLINED);
        expect(r.isMutual()).toBe(false);
    });

    it("can only be answered once", () =>
    {
        const r = asked();
        r.decline();
        expect(() => r.accept()).toThrow("already been answered");
        expect(() => r.decline()).toThrow("already been answered");
    });
});
