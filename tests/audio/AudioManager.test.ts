import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AudioManager } from "../../lib/audio/AudioManager";
import { MUTE_KEY } from "../../lib/audio/muteStorage";
import { ShotResult } from "../../lib/enums";

// stands in for HTMLAudioElement: records every element made and every play() call
class FakeAudio
{
    public static made: FakeAudio[] = [];
    public static rejectPlay = false;

    public paused = true;
    public ended = false;
    public muted = false;
    public volume = 1;
    public currentTime = 0;
    public preload = "";
    public readonly play = vi.fn(() => {
        if (FakeAudio.rejectPlay) {
            return Promise.reject(new Error("NotAllowedError"));
        }
        this.paused = false;
        return Promise.resolve();
    });
    public readonly pause = vi.fn(() => { this.paused = true; });

    public readonly src: string;

    public constructor(src: string)
    {
        this.src = src;
        FakeAudio.made.push(this);
    }

    public cloneNode(): FakeAudio
    {
        return new FakeAudio(this.src);
    }
}

function fakeWindow(saved: Record<string, string> = {}): EventTarget & { localStorage: Pick<Storage, "getItem" | "setItem"> }
{
    const target = new EventTarget();
    return Object.assign(target, {
        localStorage: {
            getItem: (key: string) => saved[key] ?? null,
            setItem: (key: string, value: string) => { saved[key] = value; }
        }
    });
}

function madeFor(file: string): FakeAudio[]
{
    return FakeAudio.made.filter(a => a.src === `/sounds/${file}.mp3`);
}

// lets the prime's then/finally run
async function flush(): Promise<void>
{
    await new Promise(resolve => setTimeout(resolve, 0));
}

describe("AudioManager", () =>
{
    beforeEach(() =>
    {
        FakeAudio.made = [];
        FakeAudio.rejectPlay = false;
        vi.stubGlobal("Audio", FakeAudio);
        vi.stubGlobal("window", fakeWindow());
    });

    afterEach(() =>
    {
        vi.unstubAllGlobals();
    });

    it("plays the named sound", () =>
    {
        new AudioManager(true).play("turn");
        expect(madeFor("turn")).toHaveLength(1);
        expect(madeFor("turn")[0].play).toHaveBeenCalledOnce();
    });

    it.each([
        [ShotResult.MISS, "miss"],
        [ShotResult.HIT, "hit"],
        [ShotResult.SUNK, "sunk"]
    ] as const)("playForShot(%s) plays %s", (result, file) =>
    {
        new AudioManager(true).playForShot(result);
        expect(madeFor(file)[0].play).toHaveBeenCalledOnce();
    });

    it("does nothing while the flag is off", () =>
    {
        const manager = new AudioManager(false);
        manager.play("hit");
        manager.installUnlock();
        window.dispatchEvent(new Event("pointerdown"));
        expect(FakeAudio.made).toHaveLength(0);
    });

    it("does nothing on the server", () =>
    {
        vi.stubGlobal("window", undefined);
        new AudioManager(true).play("hit");
        expect(FakeAudio.made).toHaveLength(0);
    });

    it("does nothing while muted, and plays again once unmuted", () =>
    {
        const manager = new AudioManager(true);
        manager.setMuted(true);
        manager.play("hit");
        expect(FakeAudio.made).toHaveLength(0);

        manager.setMuted(false);
        manager.play("hit");
        expect(madeFor("hit")[0].play).toHaveBeenCalledOnce();
    });

    it("starts muted when the player muted on an earlier visit", () =>
    {
        vi.stubGlobal("window", fakeWindow({ [MUTE_KEY]: "true" }));
        const manager = new AudioManager(true);
        expect(manager.isMuted()).toBe(true);
        manager.play("tick");
        expect(FakeAudio.made).toHaveLength(0);
    });

    it("reuses the element once it has finished", () =>
    {
        const manager = new AudioManager(true);
        manager.play("miss");
        madeFor("miss")[0].paused = true;
        manager.play("miss");
        expect(madeFor("miss")).toHaveLength(1);
        expect(madeFor("miss")[0].play).toHaveBeenCalledTimes(2);
    });

    it("plays a copy when the same sound is still playing, so both are heard", () =>
    {
        const manager = new AudioManager(true);
        manager.play("hit");
        manager.play("hit");
        const [first, copy] = madeFor("hit");
        expect(first.play).toHaveBeenCalledOnce();
        expect(copy.play).toHaveBeenCalledOnce();
    });

    it("clamps volume and applies it to new and existing sounds", () =>
    {
        const manager = new AudioManager(true);
        manager.play("hit");
        manager.setVolume(2);
        expect(manager.getVolume()).toBe(1);
        manager.setVolume(-1);
        expect(manager.getVolume()).toBe(0);
        manager.setVolume(0.4);
        expect(madeFor("hit")[0].volume).toBe(0.4);
        manager.play("miss");
        expect(madeFor("miss")[0].volume).toBe(0.4);
    });

    it("primes every sound once, silently, on the first press", async () =>
    {
        const manager = new AudioManager(true);
        manager.installUnlock();
        manager.installUnlock();
        expect(FakeAudio.made).toHaveLength(0);

        window.dispatchEvent(new Event("pointerdown"));
        window.dispatchEvent(new Event("keydown"));
        await flush();

        expect(FakeAudio.made).toHaveLength(8);
        for (const element of FakeAudio.made) {
            expect(element.play).toHaveBeenCalledOnce();
            expect(element.pause).toHaveBeenCalledOnce();
            expect(element.muted).toBe(false);
            expect(element.preload).toBe("auto");
        }
    });

    it("unlocks on a key press too, for keyboard players", async () =>
    {
        const manager = new AudioManager(true);
        manager.installUnlock();
        window.dispatchEvent(new Event("keydown"));
        await flush();
        expect(FakeAudio.made).toHaveLength(8);
    });

    it("never throws when the browser blocks play()", async () =>
    {
        FakeAudio.rejectPlay = true;
        const manager = new AudioManager(true);
        expect(() => manager.play("hit")).not.toThrow();
        manager.installUnlock();
        window.dispatchEvent(new Event("pointerdown"));
        await flush();
        expect(FakeAudio.made.every(a => !a.muted)).toBe(true);
    });
});
