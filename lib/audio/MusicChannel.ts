import { clampVolume } from "./muteStorage";

// served from public/music/; Safari before 18.4 and older iPhones can't play Ogg, so they get the AAC copy
export const MUSIC_SOURCES = [
    { src: "/music/battle-theme.ogg", type: 'audio/ogg; codecs="vorbis"' },
    { src: "/music/battle-theme.m4a", type: 'audio/mp4; codecs="mp4a.40.2"' }
] as const;

export const FADE_IN_MS = 1500;
export const FADE_OUT_MS = 500;
export const DUCK_MS = 1200;
export const DUCK_LEVEL = 0.5;
// small steps so a fade sounds smooth; 50 ms is below what the ear picks out
const FADE_STEP_MS = 50;

/** The first source this browser says it can play, or null if none. */
export function pickMusicSource(probe: Pick<HTMLAudioElement, "canPlayType">): string | null
{
    return MUSIC_SOURCES.find(source => probe.canPlayType(source.type) !== "")?.src ?? null;
}

/**
 * The background music: one looping element shared by every screen.
 * It plays while it is wanted (start was called), not muted and the tab is visible.
 * Volume = chosen volume x duck (while a big effect plays) x fade (0..1, for fade in/out).
 * Note: iOS ignores element.volume, so on iPhone only mute works, not the slider, fades or duck.
 */
export class MusicChannel
{
    private element: HTMLAudioElement | null = null;
    private wanted = false;
    private muted = false;
    private hidden = false;
    private volume: number;
    private ducked = false;
    private fade = 0;
    private fadeTimer: ReturnType<typeof setInterval> | null = null;
    private duckTimer: ReturnType<typeof setTimeout> | null = null;

    public constructor(volume: number, muted: boolean)
    {
        this.volume = clampVolume(volume, 0);
        this.muted = muted;
    }

    /** Starts the music with a fade in. Does nothing if it is already playing, so it never restarts. */
    public start(): void
    {
        this.wanted = true;
        this.sync();
    }

    /**
     * Inside the first click: a silent play and pause, so Safari lets the music start later
     * without a click (when the battle begins). Skipped while muted, so nothing downloads.
     */
    public prime(): void
    {
        if (this.muted || this.isPlaying()) {
            return;
        }
        const element = this.getElement();
        if (element === null) {
            return;
        }
        element.muted = true;
        element.play()
            // start() may have run meanwhile; only pause if the music still isn't wanted
            .then(() => { if (!this.wanted) element.pause(); })
            .catch(() => undefined)
            .finally(() => { element.muted = false; });
    }

    /** Fades the music out and pauses it, e.g. at the end of a game. */
    public stop(): void
    {
        this.wanted = false;
        if (this.isPlaying()) {
            this.fadeTo(0, FADE_OUT_MS, () => this.element?.pause());
        }
    }

    public isPlaying(): boolean
    {
        return this.element !== null && !this.element.paused;
    }

    public setMuted(muted: boolean): void
    {
        this.muted = muted;
        this.sync();
    }

    public setVolume(volume: number): void
    {
        this.volume = clampVolume(volume, this.volume);
        this.apply();
    }

    public setHidden(hidden: boolean): void
    {
        this.hidden = hidden;
        this.sync();
    }

    /** Halves the music for a moment so a big effect (hit, sunk, win, lose) stands out. */
    public duck(): void
    {
        this.ducked = true;
        this.apply();
        if (this.duckTimer !== null) {
            clearTimeout(this.duckTimer);
        }
        this.duckTimer = setTimeout(() => {
            this.duckTimer = null;
            this.ducked = false;
            this.apply();
        }, DUCK_MS);
    }

    // muting or hiding the tab pauses at once; start fades in from silence
    private sync(): void
    {
        const shouldPlay = this.wanted && !this.muted && !this.hidden;
        if (!shouldPlay) {
            if (this.isPlaying() && (this.muted || this.hidden)) {
                this.stopFade();
                this.element?.pause();
            }
            return;
        }
        const element = this.getElement();
        if (element === null) {
            return;
        }
        // still fading out from a stop: turn round and fade back in without restarting
        if (this.isPlaying() && this.fadeTimer === null) {
            return;
        }
        if (element.paused) {
            this.fade = 0;
            this.apply();
            // blocked before the first click, or the file is missing: music just stays off
            element.play().catch(() => undefined);
        }
        this.fadeTo(1, FADE_IN_MS);
    }

    private fadeTo(target: number, ms: number, done?: () => void): void
    {
        this.stopFade();
        const steps = Math.max(1, Math.round(ms / FADE_STEP_MS));
        const change = (target - this.fade) / steps;
        let left = steps;
        this.fadeTimer = setInterval(() => {
            left -= 1;
            this.fade = left === 0 ? target : this.fade + change;
            this.apply();
            if (left === 0) {
                this.stopFade();
                done?.();
            }
        }, FADE_STEP_MS);
    }

    private stopFade(): void
    {
        if (this.fadeTimer !== null) {
            clearInterval(this.fadeTimer);
            this.fadeTimer = null;
        }
    }

    private apply(): void
    {
        if (this.element !== null) {
            this.element.volume = clampVolume(this.volume * (this.ducked ? DUCK_LEVEL : 1) * this.fade, 0);
        }
    }

    // made on first use, so the 800 KB file only loads once music is wanted
    private getElement(): HTMLAudioElement | null
    {
        if (this.element !== null) {
            return this.element;
        }
        const element = new Audio();
        const src = pickMusicSource(element);
        if (src === null) {
            return null;
        }
        element.src = src;
        element.loop = true;
        element.preload = "auto";
        this.element = element;
        this.apply();
        return element;
    }
}
