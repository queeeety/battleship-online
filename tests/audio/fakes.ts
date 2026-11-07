import { vi } from "vitest";

// stands in for HTMLAudioElement: records every element made and every play() call
export class FakeAudio
{
    public static made: FakeAudio[] = [];
    public static rejectPlay = false;
    // what canPlayType says yes to; Chrome and Firefox play Ogg, old Safari only AAC
    public static playable: string[] = ["audio/ogg", "audio/mp4"];

    public paused = true;
    public ended = false;
    public muted = false;
    public loop = false;
    public volume = 1;
    public currentTime = 0;
    public preload = "";
    public src: string;
    public readonly play = vi.fn(() => {
        if (FakeAudio.rejectPlay) {
            return Promise.reject(new Error("NotAllowedError"));
        }
        this.paused = false;
        return Promise.resolve();
    });
    public readonly pause = vi.fn(() => { this.paused = true; });

    public constructor(src = "")
    {
        this.src = src;
        FakeAudio.made.push(this);
    }

    public static reset(): void
    {
        FakeAudio.made = [];
        FakeAudio.rejectPlay = false;
        FakeAudio.playable = ["audio/ogg", "audio/mp4"];
    }

    public canPlayType(type: string): string
    {
        return FakeAudio.playable.some(prefix => type.startsWith(prefix)) ? "maybe" : "";
    }

    public cloneNode(): FakeAudio
    {
        return new FakeAudio(this.src);
    }
}

export type FakeWindow = EventTarget & { localStorage: Pick<Storage, "getItem" | "setItem"> };

/** A window with a working localStorage over saved (which it writes back into). */
export function fakeWindow(saved: Record<string, string> = {}): FakeWindow
{
    const target = new EventTarget();
    return Object.assign(target, {
        localStorage: {
            getItem: (key: string) => saved[key] ?? null,
            setItem: (key: string, value: string) => { saved[key] = value; }
        }
    });
}

/** A document whose visibility tests can flip, firing visibilitychange like the browser. */
export function fakeDocument(): EventTarget & { visibilityState: DocumentVisibilityState; setHidden: (hidden: boolean) => void }
{
    const target = new EventTarget();
    const doc = Object.assign(target, {
        visibilityState: "visible" as DocumentVisibilityState,
        setHidden(hidden: boolean): void
        {
            doc.visibilityState = hidden ? "hidden" : "visible";
            doc.dispatchEvent(new Event("visibilitychange"));
        }
    });
    return doc;
}

export function effectsMade(file: string): FakeAudio[]
{
    return FakeAudio.made.filter(a => a.src === `/sounds/${file}.mp3`);
}

export function musicMade(): FakeAudio[]
{
    return FakeAudio.made.filter(a => a.src.startsWith("/music/"));
}
