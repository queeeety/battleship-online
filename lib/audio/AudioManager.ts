import { AUDIO_ENABLED } from "../config/features";
import { ShotResult } from "../enums";
import { FADE_OUT_MS, MusicChannel } from "./MusicChannel";
import { browserStorage, clampVolume } from "./muteStorage";
import { loadSoundSettings, type SoundSettings, type SoundSettingsTarget } from "./soundSettings";

export type SoundName = "hit" | "miss" | "sunk" | "tick" | "error" | "turn" | "win" | "lose";

// served from public/sounds/
const SOUND_FILES: Readonly<Record<SoundName, string>> = {
    hit: "/sounds/hit.mp3",
    miss: "/sounds/miss.mp3",
    sunk: "/sounds/sunk.mp3",
    tick: "/sounds/tick.mp3",
    error: "/sounds/error.mp3",
    turn: "/sounds/turn.mp3",
    win: "/sounds/win.mp3",
    lose: "/sounds/lose.mp3"
};

const SOUND_NAMES = Object.keys(SOUND_FILES) as SoundName[];

// big moments: the music dips under these so they stand out
const DUCKING_SOUNDS: ReadonlySet<SoundName> = new Set(["hit", "sunk", "win", "lose"]);
// the game is over: the music fades out first, then this plays
const ENDING_SOUNDS: ReadonlySet<SoundName> = new Set(["win", "lose"]);

// the first press or key counts as the "user gesture" browsers wait for before allowing sound
const UNLOCK_EVENTS = ["pointerdown", "keydown"] as const;

// exported so soundForUpdate picks the same sound as playForShot
export const SHOT_SOUNDS: Readonly<Record<ShotResult, SoundName>> = {
    [ShotResult.MISS]: "miss",
    [ShotResult.HIT]: "hit",
    [ShotResult.SUNK]: "sunk"
};

/**
 * Plays game sounds (effects) and the background music, each with its own mute and volume.
 * Does nothing while the audio flag is off.
 */
export class AudioManager implements SoundSettingsTarget
{
    // created on first use, so nothing loads on the server or while the flag is off
    private readonly sounds = new Map<SoundName, HTMLAudioElement>();
    // null until first needed: then the saved choice is read, so the countdown respects it before the menu mounts
    private settings: SoundSettings | null = null;
    private music: MusicChannel | null = null;
    private unlockInstalled = false;
    private readonly enabled: boolean;

    // enabled is a parameter so tests can switch the flag without mocking the module
    public constructor(enabled: boolean = AUDIO_ENABLED)
    {
        this.enabled = enabled;
    }

    /** The current settings; a new object after every change, never mutated. */
    public getSettings(): SoundSettings
    {
        this.settings ??= loadSoundSettings(browserStorage());
        return this.settings;
    }

    /** Replaces every setting at once (the Sound menu uses this through SoundSettingsStore). */
    public applySettings(settings: SoundSettings): void
    {
        const current = this.getSettings();
        const next: SoundSettings = {
            effectsMuted: settings.effectsMuted,
            effectsVolume: clampVolume(settings.effectsVolume, current.effectsVolume),
            musicMuted: settings.musicMuted,
            musicVolume: clampVolume(settings.musicVolume, current.musicVolume)
        };
        this.settings = next;
        this.sounds.forEach(element => { element.volume = next.effectsVolume; });
        this.music?.setMuted(next.musicMuted);
        this.music?.setVolume(next.musicVolume);
    }

    /** Effects mute (the original setting; music has its own). */
    public setMuted(muted: boolean): void
    {
        this.applySettings({ ...this.getSettings(), effectsMuted: muted });
    }

    public isMuted(): boolean
    {
        return this.getSettings().effectsMuted;
    }

    /** Effects volume, 0..1. */
    public setVolume(volume: number): void
    {
        this.applySettings({ ...this.getSettings(), effectsVolume: volume });
    }

    public getVolume(): number
    {
        return this.getSettings().effectsVolume;
    }

    public setMusicMuted(muted: boolean): void
    {
        this.applySettings({ ...this.getSettings(), musicMuted: muted });
    }

    public isMusicMuted(): boolean
    {
        return this.getSettings().musicMuted;
    }

    public setMusicVolume(volume: number): void
    {
        this.applySettings({ ...this.getSettings(), musicVolume: volume });
    }

    public getMusicVolume(): number
    {
        return this.getSettings().musicVolume;
    }

    /** Starts the background music with a fade in; safe to call again, it never restarts. */
    public startMusic(): void
    {
        this.getMusic()?.start();
    }

    /** Fades the music out, e.g. when the battle ends or the player leaves it. */
    public stopMusic(): void
    {
        this.music?.stop();
    }

    public play(sound: SoundName): void
    {
        if (!this.canPlay()) {
            return;
        }
        const music = this.getMusic();
        // the game is over: the music fades out even when effects are muted
        const fading = ENDING_SOUNDS.has(sound) && music?.isPlaying() === true;
        if (ENDING_SOUNDS.has(sound)) {
            music?.stop();
        }
        if (this.isMuted()) {
            return;
        }
        if (fading) {
            setTimeout(() => this.playEffect(sound), FADE_OUT_MS);
            return;
        }
        if (DUCKING_SOUNDS.has(sound)) {
            music?.duck();
        }
        this.playEffect(sound);
    }

    public playForShot(result: ShotResult): void
    {
        this.play(SHOT_SOUNDS[result]);
    }

    /**
     * Waits for the first press or key, then primes every sound and the music (silently).
     * After that, sounds that arrive over Realtime (the opponent's shots) are allowed to play.
     * Also pauses the music while the tab is hidden. Safe to call many times; only the first adds listeners.
     */
    public installUnlock(): void
    {
        if (this.unlockInstalled || !this.canPlay()) {
            return;
        }
        this.unlockInstalled = true;
        const onGesture = (): void => {
            UNLOCK_EVENTS.forEach(type => window.removeEventListener(type, onGesture));
            this.primeAll();
            this.getMusic()?.prime();
        };
        UNLOCK_EVENTS.forEach(type => window.addEventListener(type, onGesture));
        if (typeof document !== "undefined") {
            document.addEventListener("visibilitychange", () => {
                this.music?.setHidden(document.visibilityState === "hidden");
            });
        }
    }

    private playEffect(sound: SoundName): void
    {
        const element = this.getElement(sound);
        // still playing from the last shot: play a copy so the two overlap instead of cutting off
        const target = element.paused || element.ended ? element : (element.cloneNode() as HTMLAudioElement);
        target.volume = this.getVolume();
        target.currentTime = 0;
        // browsers reject play() before the user has interacted with the page; a missed sound is fine
        target.play().catch(() => undefined);
    }

    private canPlay(): boolean
    {
        return this.enabled && typeof window !== "undefined" && typeof Audio !== "undefined";
    }

    private getMusic(): MusicChannel | null
    {
        if (!this.canPlay()) {
            return null;
        }
        const { musicVolume, musicMuted } = this.getSettings();
        this.music ??= new MusicChannel(musicVolume, musicMuted);
        return this.music;
    }

    // a silent play inside the gesture is what Safari needs before each element may play later
    private primeAll(): void
    {
        for (const sound of SOUND_NAMES) {
            const element = this.getElement(sound);
            if (!element.paused) {
                continue;
            }
            element.muted = true;
            element.play()
                .then(() => {
                    element.pause();
                    element.currentTime = 0;
                })
                .catch(() => undefined)
                .finally(() => { element.muted = false; });
        }
    }

    private getElement(sound: SoundName): HTMLAudioElement
    {
        const existing = this.sounds.get(sound);
        if (existing) {
            return existing;
        }
        const element = new Audio(SOUND_FILES[sound]);
        element.preload = "auto";
        element.volume = this.getVolume();
        this.sounds.set(sound, element);
        return element;
    }
}
