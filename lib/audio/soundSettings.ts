import {
    EFFECTS_VOLUME_KEY,
    MUSIC_MUTE_KEY,
    MUSIC_VOLUME_KEY,
    MUTE_KEY,
    loadFlag,
    loadVolume,
    saveSetting
} from "./muteStorage";

/** What the player chose in the Sound menu. Effects and music are separate. */
export interface SoundSettings
{
    readonly effectsMuted: boolean;
    readonly effectsVolume: number;
    readonly musicMuted: boolean;
    readonly musicVolume: number;
}

// music sits well under the effects so shots stay easy to hear
export const DEFAULT_SOUND_SETTINGS: SoundSettings = {
    effectsMuted: false,
    effectsVolume: 0.8,
    musicMuted: false,
    musicVolume: 0.2
};

/** The saved settings; anything missing, bad or unreadable falls back to the default. */
export function loadSoundSettings(storage: Pick<Storage, "getItem"> | null): SoundSettings
{
    const d = DEFAULT_SOUND_SETTINGS;
    return {
        effectsMuted: loadFlag(storage, MUTE_KEY, d.effectsMuted),
        effectsVolume: loadVolume(storage, EFFECTS_VOLUME_KEY, d.effectsVolume),
        musicMuted: loadFlag(storage, MUSIC_MUTE_KEY, d.musicMuted),
        musicVolume: loadVolume(storage, MUSIC_VOLUME_KEY, d.musicVolume)
    };
}

/** Saves every setting; never throws (see saveSetting). */
export function saveSoundSettings(storage: Pick<Storage, "setItem"> | null, settings: SoundSettings): void
{
    saveSetting(storage, MUTE_KEY, settings.effectsMuted);
    saveSetting(storage, EFFECTS_VOLUME_KEY, settings.effectsVolume);
    saveSetting(storage, MUSIC_MUTE_KEY, settings.musicMuted);
    saveSetting(storage, MUSIC_VOLUME_KEY, settings.musicVolume);
}

/** The part of AudioManager the store drives; an interface so tests can pass a stand-in. */
export interface SoundSettingsTarget
{
    getSettings(): SoundSettings;
    applySettings(settings: SoundSettings): void;
}

/**
 * Lets React components read and change the sound settings (useSyncExternalStore shape).
 * AudioManager holds the current values; this saves changes and tells listeners.
 */
export class SoundSettingsStore
{
    private readonly listeners = new Set<() => void>();

    public constructor(
        private readonly target: SoundSettingsTarget,
        private readonly storage: () => Pick<Storage, "setItem"> | null
    )
    {
    }

    public readonly subscribe = (listener: () => void): (() => void) => {
        this.listeners.add(listener);
        return () => { this.listeners.delete(listener); };
    };

    // AudioManager swaps in a new object on every change, so React sees the same snapshot until then
    public readonly get = (): SoundSettings => this.target.getSettings();

    // the server can't see localStorage, so it renders the defaults
    public readonly getServer = (): SoundSettings => DEFAULT_SOUND_SETTINGS;

    public update(change: Partial<SoundSettings>): void
    {
        const next = { ...this.target.getSettings(), ...change };
        this.target.applySettings(next);
        saveSoundSettings(this.storage(), this.target.getSettings());
        this.listeners.forEach(listener => listener());
    }
}
