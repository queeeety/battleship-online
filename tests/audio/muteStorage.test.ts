import { describe, it, expect } from "vitest";
import { loadMuted, saveMuted, MUTE_KEY } from "../../lib/audio/muteStorage";

// a plain object that behaves like localStorage for the two methods we use
function fakeStorage(initial: Record<string, string> = {}): Pick<Storage, "getItem" | "setItem">
{
    const data = { ...initial };
    return {
        getItem: (key) => data[key] ?? null,
        setItem: (key, value) => { data[key] = value; }
    };
}

// like private mode or a full disk: every call throws
const throwingStorage: Pick<Storage, "getItem" | "setItem"> = {
    getItem: () => { throw new Error("blocked"); },
    setItem: () => { throw new Error("blocked"); }
};

describe("saveMuted", () =>
{
    it.each([true, false])("saves %s as text under the mute key", (muted) =>
    {
        const storage = fakeStorage();
        saveMuted(storage, muted);
        expect(storage.getItem(MUTE_KEY)).toBe(String(muted));
    });

    it("does not crash when storage throws or is missing", () =>
    {
        expect(() => saveMuted(throwingStorage, true)).not.toThrow();
        expect(() => saveMuted(null, true)).not.toThrow();
    });
});

describe("loadMuted", () =>
{
    it.each([true, false])("loads a saved %s", (muted) =>
    {
        const storage = fakeStorage();
        saveMuted(storage, muted);
        expect(loadMuted(storage, !muted)).toBe(muted);
    });

    it.each([true, false])("returns the fallback (%s) when nothing is saved", (fallback) =>
    {
        expect(loadMuted(fakeStorage(), fallback)).toBe(fallback);
    });

    it("returns the fallback for a value it did not write", () =>
    {
        expect(loadMuted(fakeStorage({ [MUTE_KEY]: "yes" }), false)).toBe(false);
    });

    it("returns the fallback when storage throws or is missing", () =>
    {
        expect(loadMuted(throwingStorage, true)).toBe(true);
        expect(loadMuted(null, false)).toBe(false);
    });
});
