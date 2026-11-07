// the effects mute keeps its original key, so a mute saved before music existed still applies
export const MUTE_KEY = "battleship.muted";
export const MUSIC_MUTE_KEY = "battleship.musicMuted";
export const EFFECTS_VOLUME_KEY = "battleship.effectsVolume";
export const MUSIC_VOLUME_KEY = "battleship.musicVolume";

/** Volumes are 0..1; anything else (NaN, Infinity, strings) means "use the default". */
export function clampVolume(volume: number, fallback: number): number
{
    return Number.isFinite(volume) ? Math.min(1, Math.max(0, volume)) : fallback;
}

/**
 * Reads a saved on/off choice, or fallback if none is saved.
 * Private mode or blocked storage can throw, so this never does.
 */
export function loadFlag(storage: Pick<Storage, "getItem"> | null, key: string, fallback: boolean): boolean
{
    try {
        const saved = storage?.getItem(key);
        if (saved === "true") return true;
        if (saved === "false") return false;
        return fallback;
    } catch {
        return fallback;
    }
}

/** Reads a saved volume, clamped to 0..1; missing or bad values give fallback. */
export function loadVolume(storage: Pick<Storage, "getItem"> | null, key: string, fallback: number): number
{
    try {
        const saved = storage?.getItem(key);
        // Number("") is 0, so an empty value must count as missing, not as silent
        if (saved === null || saved === undefined || saved.trim() === "") return fallback;
        return clampVolume(Number(saved), fallback);
    } catch {
        return fallback;
    }
}

/** Saves one setting; a failed write only means it is not remembered. */
export function saveSetting(storage: Pick<Storage, "setItem"> | null, key: string, value: boolean | number): void
{
    try {
        storage?.setItem(key, String(value));
    } catch {
        // storage full or blocked: the setting still works for this visit
    }
}

/** Reads the saved effects mute (the original setting), or fallback if none is saved. */
export function loadMuted(storage: Pick<Storage, "getItem"> | null, fallback: boolean): boolean
{
    return loadFlag(storage, MUTE_KEY, fallback);
}

/** Saves the effects mute. */
export function saveMuted(storage: Pick<Storage, "setItem"> | null, muted: boolean): void
{
    saveSetting(storage, MUTE_KEY, muted);
}

/** window.localStorage, or null on the server or when even reading it throws. */
export function browserStorage(): Storage | null
{
    try {
        return typeof window === "undefined" ? null : window.localStorage;
    } catch {
        return null;
    }
}
