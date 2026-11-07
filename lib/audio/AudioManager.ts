import { AUDIO_ENABLED } from "../config/features";
import { ShotResult } from "../enums";
import { browserStorage, loadMuted } from "./muteStorage";

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

// the first press or key counts as the "user gesture" browsers wait for before allowing sound
const UNLOCK_EVENTS = ["pointerdown", "keydown"] as const;

// exported so soundForUpdate picks the same sound as playForShot
export const SHOT_SOUNDS: Readonly<Record<ShotResult, SoundName>> = {
    [ShotResult.MISS]: "miss",
    [ShotResult.HIT]: "hit",
    [ShotResult.SUNK]: "sunk"
};

function clampVolume(volume: number): number
{
    return Number.isFinite(volume) ? Math.min(1, Math.max(0, volume)) : 1;
}

/**
 * Plays game sounds.
 * Does nothing while the audio flag is off.
 */
export class AudioManager
{
    // created on first use, so nothing loads on the server or while the flag is off
    private readonly sounds = new Map<SoundName, HTMLAudioElement>();
    // null until set: then the saved choice is read, so the countdown respects it before MuteToggle mounts
    private muted: boolean | null = null;
    private volume = 1;
    private unlockInstalled = false;
    private readonly enabled: boolean;

    // enabled is a parameter so tests can switch the flag without mocking the module
    public constructor(enabled: boolean = AUDIO_ENABLED)
    {
        this.enabled = enabled;
    }

    public setMuted(muted: boolean): void
    {
        this.muted = muted;
    }

    public isMuted(): boolean
    {
        return this.muted ?? loadMuted(browserStorage(), false);
    }

    public setVolume(volume: number): void
    {
        this.volume = clampVolume(volume);
        this.sounds.forEach(element => { element.volume = this.volume; });
    }

    public getVolume(): number
    {
        return this.volume;
    }

    public play(sound: SoundName): void
    {
        if (!this.canPlay() || this.isMuted()) {
            return;
        }
        const element = this.getElement(sound);
        // still playing from the last shot: play a copy so the two overlap instead of cutting off
        const target = element.paused || element.ended ? element : (element.cloneNode() as HTMLAudioElement);
        target.volume = this.volume;
        target.currentTime = 0;
        // browsers reject play() before the user has interacted with the page; a missed sound is fine
        target.play().catch(() => undefined);
    }

    public playForShot(result: ShotResult): void
    {
        this.play(SHOT_SOUNDS[result]);
    }

    /**
     * Waits for the first press or key, then loads and primes every sound.
     * After that, sounds that arrive over Realtime (the opponent's shots) are allowed to play.
     * Safe to call many times; only the first call adds listeners.
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
        };
        UNLOCK_EVENTS.forEach(type => window.addEventListener(type, onGesture));
    }

    private canPlay(): boolean
    {
        return this.enabled && typeof window !== "undefined" && typeof Audio !== "undefined";
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
        element.volume = this.volume;
        this.sounds.set(sound, element);
        return element;
    }
}
