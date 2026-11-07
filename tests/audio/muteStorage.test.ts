import { describe, it, expect } from "vitest";
import { clampVolume, loadMuted, loadVolume, saveMuted, saveSetting, MUTE_KEY, MUSIC_VOLUME_KEY } from "../../lib/audio/muteStorage";

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

describe("clampVolume", () =>
{
    it.each([
        [0.5, 0.5], [0, 0], [1, 1], [-0.2, 0], [7, 1],
        [Number.NaN, 0.3], [Number.POSITIVE_INFINITY, 0.3]
    ])("clampVolume(%s) is %s", (volume, expected) =>
    {
        expect(clampVolume(volume, 0.3)).toBe(expected);
    });
});

describe("loadVolume", () =>
{
    it("loads a saved volume", () =>
    {
        const storage = fakeStorage();
        saveSetting(storage, MUSIC_VOLUME_KEY, 0.35);
        expect(loadVolume(storage, MUSIC_VOLUME_KEY, 0.2)).toBe(0.35);
    });

    it.each(["2", "-1"])("clamps a saved %s into 0..1", (saved) =>
    {
        const volume = loadVolume(fakeStorage({ [MUSIC_VOLUME_KEY]: saved }), MUSIC_VOLUME_KEY, 0.2);
        expect(volume).toBe(saved === "2" ? 1 : 0);
    });

    // "" would become 0 (silent) if read as a number
    it.each(["loud", "", "  ", "NaN", "Infinity"])("falls back for the bad value %j", (saved) =>
    {
        expect(loadVolume(fakeStorage({ [MUSIC_VOLUME_KEY]: saved }), MUSIC_VOLUME_KEY, 0.2)).toBe(0.2);
    });

    it("falls back when nothing is saved, storage throws, or there is no storage", () =>
    {
        expect(loadVolume(fakeStorage(), MUSIC_VOLUME_KEY, 0.2)).toBe(0.2);
        expect(loadVolume(throwingStorage, MUSIC_VOLUME_KEY, 0.2)).toBe(0.2);
        expect(loadVolume(null, MUSIC_VOLUME_KEY, 0.2)).toBe(0.2);
    });
});

describe("saveSetting", () =>
{
    it("does not crash when storage throws or is missing", () =>
    {
        expect(() => saveSetting(throwingStorage, MUSIC_VOLUME_KEY, 0.5)).not.toThrow();
        expect(() => saveSetting(null, MUSIC_VOLUME_KEY, 0.5)).not.toThrow();
    });
});
