export const MUTE_KEY = "battleship.muted";

/**
 * Reads the saved mute choice, or fallback if none is saved.
 * Private mode or blocked storage can throw, so this never does.
 */
export function loadMuted(storage: Pick<Storage, "getItem"> | null, fallback: boolean): boolean
{
    try {
        const saved = storage?.getItem(MUTE_KEY);
        if (saved === "true") return true;
        if (saved === "false") return false;
        return fallback;
    } catch {
        return fallback;
    }
}

/** Saves the mute choice; a failed write only means it is not remembered. */
export function saveMuted(storage: Pick<Storage, "setItem"> | null, muted: boolean): void
{
    try {
        storage?.setItem(MUTE_KEY, String(muted));
    } catch {
        // storage full or blocked: the toggle still works for this visit
    }
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
