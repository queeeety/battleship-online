import { describe, expect, it, vi } from "vitest";
import {
    EFFECTS_VOLUME_KEY,
    MUSIC_MUTE_KEY,
    MUSIC_VOLUME_KEY,
    MUTE_KEY
} from "../../lib/audio/muteStorage";
import {
    DEFAULT_SOUND_SETTINGS,
    SoundSettingsStore,
    loadSoundSettings,
    saveSoundSettings,
    type SoundSettings,
    type SoundSettingsTarget
} from "../../lib/audio/soundSettings";

function fakeStorage(initial: Record<string, string> = {}): Pick<Storage, "getItem" | "setItem"> & { data: Record<string, string> }
{
    const data = { ...initial };
    return {
        data,
        getItem: (key) => data[key] ?? null,
        setItem: (key, value) => { data[key] = value; }
    };
}

const blocked: Pick<Storage, "getItem" | "setItem"> = {
    getItem: () => { throw new Error("blocked"); },
    setItem: () => { throw new Error("blocked"); }
};

// holds settings the way AudioManager does: a new object on every change
function fakeTarget(): SoundSettingsTarget
{
    let current: SoundSettings = DEFAULT_SOUND_SETTINGS;
    return {
        getSettings: () => current,
        applySettings: (next) => { current = next; }
    };
}

describe("loadSoundSettings", () =>
{
    it("gives the defaults when nothing is saved", () =>
    {
        expect(loadSoundSettings(fakeStorage())).toEqual(DEFAULT_SOUND_SETTINGS);
    });

    it("gives the defaults when storage is blocked or missing", () =>
    {
        expect(loadSoundSettings(blocked)).toEqual(DEFAULT_SOUND_SETTINGS);
        expect(loadSoundSettings(null)).toEqual(DEFAULT_SOUND_SETTINGS);
    });

    it("reads all four saved settings", () =>
    {
        const storage = fakeStorage({
            [MUTE_KEY]: "true",
            [EFFECTS_VOLUME_KEY]: "0.5",
            [MUSIC_MUTE_KEY]: "true",
            [MUSIC_VOLUME_KEY]: "0.1"
        });
        expect(loadSoundSettings(storage)).toEqual({
            effectsMuted: true, effectsVolume: 0.5, musicMuted: true, musicVolume: 0.1
        });
    });

    it("keeps good values and defaults the bad ones", () =>
    {
        const storage = fakeStorage({ [MUTE_KEY]: "true", [MUSIC_VOLUME_KEY]: "loud", [EFFECTS_VOLUME_KEY]: "9" });
        expect(loadSoundSettings(storage)).toEqual({
            ...DEFAULT_SOUND_SETTINGS, effectsMuted: true, effectsVolume: 1
        });
    });
});

describe("saveSoundSettings", () =>
{
    it("saves under battleship.* keys and reads back the same", () =>
    {
        const storage = fakeStorage();
        const settings = { effectsMuted: true, effectsVolume: 0.6, musicMuted: false, musicVolume: 0.25 };
        saveSoundSettings(storage, settings);
        expect(Object.keys(storage.data).every(key => key.startsWith("battleship."))).toBe(true);
        expect(loadSoundSettings(storage)).toEqual(settings);
    });

    it("does not throw when storage is blocked", () =>
    {
        expect(() => saveSoundSettings(blocked, DEFAULT_SOUND_SETTINGS)).not.toThrow();
    });
});

describe("SoundSettingsStore", () =>
{
    it("applies a change, saves it and tells listeners", () =>
    {
        const storage = fakeStorage();
        const store = new SoundSettingsStore(fakeTarget(), () => storage);
        const listener = vi.fn();
        store.subscribe(listener);

        store.update({ musicMuted: true });
        expect(store.get().musicMuted).toBe(true);
        expect(store.get().effectsMuted).toBe(false);
        expect(storage.data[MUSIC_MUTE_KEY]).toBe("true");
        expect(listener).toHaveBeenCalledOnce();
    });

    it("hands React the same snapshot until something changes", () =>
    {
        const store = new SoundSettingsStore(fakeTarget(), () => null);
        const before = store.get();
        expect(store.get()).toBe(before);
        store.update({ effectsVolume: 0.3 });
        expect(store.get()).not.toBe(before);
        expect(before.effectsVolume).toBe(DEFAULT_SOUND_SETTINGS.effectsVolume);
    });

    it("stops calling a listener once it unsubscribes", () =>
    {
        const store = new SoundSettingsStore(fakeTarget(), () => null);
        const listener = vi.fn();
        const unsubscribe = store.subscribe(listener);
        unsubscribe();
        store.update({ musicMuted: true });
        expect(listener).not.toHaveBeenCalled();
    });

    it("still works for this visit when storage is blocked", () =>
    {
        const store = new SoundSettingsStore(fakeTarget(), () => blocked);
        expect(() => store.update({ effectsMuted: true })).not.toThrow();
        expect(store.get().effectsMuted).toBe(true);
    });

    it("renders the defaults on the server", () =>
    {
        expect(new SoundSettingsStore(fakeTarget(), () => null).getServer()).toEqual(DEFAULT_SOUND_SETTINGS);
    });
});
