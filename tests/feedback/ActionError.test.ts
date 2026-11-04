import { describe, it, expect } from "vitest";
import { shouldFireStale } from "../../components/feedback/ActionError";
import { SERVER_FAILURES } from "../../components/feedback/ErrorState";
import { JoinError } from "../../lib/enums";

const JOIN_ERRORS = Object.values(JoinError).filter((v): v is JoinError => typeof v === "number");
const NOT_STALE = SERVER_FAILURES.filter((error) => error !== "STALE");

describe("shouldFireStale", () => {
    it("fires the first time STALE appears", () => {
        expect(shouldFireStale("STALE", false)).toBe(true);
    });

    // React dev mode runs the effect twice; the second run must not refetch again
    it("doesn't fire again for the same STALE", () => {
        expect(shouldFireStale("STALE", true)).toBe(false);
    });

    it.each(NOT_STALE)("never fires for %s", (error) => {
        expect(shouldFireStale(error, false)).toBe(false);
        expect(shouldFireStale(error, true)).toBe(false);
    });

    it.each(JOIN_ERRORS)("never fires for JoinError %s", (error) => {
        expect(shouldFireStale(error, false)).toBe(false);
    });
});
