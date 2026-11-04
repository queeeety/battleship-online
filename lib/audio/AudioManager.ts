import { AUDIO_ENABLED } from "../config/features";
import { ShotResult } from "../enums";

export type SoundName = "hit" | "miss" | "sunk" | "tick" | "error" | "turn";

// served from public/sounds/
const SOUND_FILES: Readonly<Record<SoundName, string>> = {
    hit: "/sounds/hit.mp3",
    miss: "/sounds/miss.mp3",
    sunk: "/sounds/sunk.mp3",
    tick: "/sounds/tick.mp3",
    error: "/sounds/error.mp3",
    turn: "/sounds/turn.mp3"
};

// exported so soundForUpdate picks the same sound as playForShot
export const SHOT_SOUNDS: Readonly<Record<ShotResult, SoundName>> = {
    [ShotResult.MISS]: "miss",
    [ShotResult.HIT]: "hit",
    [ShotResult.SUNK]: "sunk"
};

/**
 * Plays game sounds.
 * Does nothing while AUDIO_ENABLED is false.
 */
export class AudioManager
{
    // created on first play, so nothing loads on the server or while the flag is off
    private readonly sounds = new Map<SoundName, HTMLAudioElement>();
    private muted = false;

    public setMuted(muted: boolean): void
    {
        this.muted = muted;
    }

    public isMuted(): boolean
    {
        return this.muted;
    }

    public play(sound: SoundName): void
    {
        if (!AUDIO_ENABLED || this.muted || typeof window === "undefined") {
            return;
        }
        const element = this.getElement(sound);
        // restart if the same sound is still playing from the last shot
        element.currentTime = 0;
        // browsers reject play() before the user has interacted with the page; a missed sound is fine
        element.play().catch(() => undefined);
    }

    public playForShot(result: ShotResult): void
    {
        this.play(SHOT_SOUNDS[result]);
    }

    private getElement(sound: SoundName): HTMLAudioElement
    {
        const existing = this.sounds.get(sound);
        if (existing) {
            return existing;
        }
        const element = new Audio(SOUND_FILES[sound]);
        this.sounds.set(sound, element);
        return element;
    }
}
