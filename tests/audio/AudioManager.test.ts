import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AudioManager } from "../../lib/audio/AudioManager";
import { DUCK_LEVEL, DUCK_MS, FADE_IN_MS, FADE_OUT_MS } from "../../lib/audio/MusicChannel";
import { MUSIC_MUTE_KEY, MUTE_KEY } from "../../lib/audio/muteStorage";
import { ShotResult } from "../../lib/enums";
import { FakeAudio, effectsMade as madeFor, fakeDocument, fakeWindow, musicMade } from "./fakes";

// lets the prime's then/finally run
async function flush(): Promise<void>
{
    await new Promise(resolve => setTimeout(resolve, 0));
}

describe("AudioManager", () =>
{
    beforeEach(() =>
    {
        FakeAudio.reset();
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

        const effects = FakeAudio.made.filter(a => a.src.startsWith("/sounds/"));
        expect(effects).toHaveLength(8);
        for (const element of effects) {
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
        expect(FakeAudio.made.filter(a => a.src.startsWith("/sounds/"))).toHaveLength(8);
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

describe("AudioManager music", () =>
{
    let doc: ReturnType<typeof fakeDocument>;

    beforeEach(() =>
    {
        vi.useFakeTimers();
        FakeAudio.reset();
        doc = fakeDocument();
        vi.stubGlobal("Audio", FakeAudio);
        vi.stubGlobal("window", fakeWindow());
        vi.stubGlobal("document", doc);
    });

    afterEach(() =>
    {
        vi.useRealTimers();
        vi.unstubAllGlobals();
    });

    function music(): FakeAudio
    {
        expect(musicMade()).toHaveLength(1);
        return musicMade()[0];
    }

    it("defaults to effects 0.8 and music 0.2", () =>
    {
        const manager = new AudioManager(true);
        expect(manager.getVolume()).toBe(0.8);
        expect(manager.getMusicVolume()).toBe(0.2);
    });

    // promise callbacks (the prime's then/finally) without moving the fake clock
    async function settle(): Promise<void>
    {
        for (let i = 0; i < 5; i++) {
            await Promise.resolve();
        }
    }

    it("primes the music silently on the first press, without starting it", async () =>
    {
        const manager = new AudioManager(true);
        manager.installUnlock();
        expect(musicMade()).toHaveLength(0);

        window.dispatchEvent(new Event("pointerdown"));
        expect(music().loop).toBe(true);
        expect(music().src).toBe("/music/battle-theme.ogg");
        expect(music().play).toHaveBeenCalledOnce();
        await settle();
        expect(music().paused).toBe(true);
        expect(music().muted).toBe(false);
    });

    it("keeps playing if the battle starts while the prime is still settling", async () =>
    {
        const manager = new AudioManager(true);
        manager.installUnlock();
        window.dispatchEvent(new Event("pointerdown"));
        manager.startMusic();
        await settle();
        expect(music().paused).toBe(false);
    });

    it("doesn't prime (or download) the music while it is muted", () =>
    {
        const manager = new AudioManager(true);
        manager.setMusicMuted(true);
        manager.installUnlock();
        window.dispatchEvent(new Event("pointerdown"));
        expect(musicMade()).toHaveLength(0);
    });

    it("starts looping and fades in to the music volume", () =>
    {
        const manager = new AudioManager(true);
        manager.startMusic();
        expect(music().play).toHaveBeenCalledOnce();
        expect(music().volume).toBe(0);

        vi.advanceTimersByTime(FADE_IN_MS / 2);
        expect(music().volume).toBeGreaterThan(0);
        expect(music().volume).toBeLessThan(0.2);
        vi.advanceTimersByTime(FADE_IN_MS / 2);
        expect(music().volume).toBeCloseTo(0.2);
    });

    it("fades out and pauses on stopMusic (leaving the battle)", () =>
    {
        const manager = new AudioManager(true);
        manager.startMusic();
        vi.advanceTimersByTime(FADE_IN_MS);
        manager.stopMusic();
        expect(music().paused).toBe(false);
        vi.advanceTimersByTime(FADE_OUT_MS);
        expect(music().paused).toBe(true);
    });

    it("never restarts on repeated start calls (every screen calls it)", () =>
    {
        const manager = new AudioManager(true);
        manager.startMusic();
        vi.advanceTimersByTime(FADE_IN_MS);
        music().currentTime = 42;

        manager.startMusic();
        manager.startMusic();
        vi.advanceTimersByTime(FADE_IN_MS);
        expect(music().play).toHaveBeenCalledOnce();
        expect(music().currentTime).toBe(42);
        expect(music().volume).toBeCloseTo(0.2);
    });

    it("tries again on the next start if the browser blocked the first", () =>
    {
        FakeAudio.rejectPlay = true;
        const manager = new AudioManager(true);
        manager.startMusic();
        expect(music().paused).toBe(true);

        FakeAudio.rejectPlay = false;
        manager.startMusic();
        expect(music().play).toHaveBeenCalledTimes(2);
        expect(music().paused).toBe(false);
    });

    it("muting music leaves effects playing", () =>
    {
        const manager = new AudioManager(true);
        manager.startMusic();
        manager.setMusicMuted(true);
        expect(music().paused).toBe(true);

        manager.play("miss");
        expect(madeFor("miss")[0].play).toHaveBeenCalledOnce();
    });

    it("muting effects leaves the music playing", () =>
    {
        const manager = new AudioManager(true);
        manager.startMusic();
        manager.setMuted(true);
        manager.play("miss");
        expect(madeFor("miss")).toHaveLength(0);
        expect(music().paused).toBe(false);
    });

    it("doesn't download the track while music is muted, and fades in once unmuted", () =>
    {
        const manager = new AudioManager(true);
        manager.setMusicMuted(true);
        manager.startMusic();
        expect(musicMade()).toHaveLength(0);

        manager.setMusicMuted(false);
        expect(music().play).toHaveBeenCalledOnce();
        vi.advanceTimersByTime(FADE_IN_MS);
        expect(music().volume).toBeCloseTo(0.2);
    });

    it("starts muted when music was muted on an earlier visit", () =>
    {
        vi.stubGlobal("window", fakeWindow({ [MUSIC_MUTE_KEY]: "true" }));
        const manager = new AudioManager(true);
        expect(manager.isMusicMuted()).toBe(true);
        expect(manager.isMuted()).toBe(false);
        manager.startMusic();
        expect(musicMade()).toHaveLength(0);
    });

    it("clamps the music volume and applies it at once", () =>
    {
        const manager = new AudioManager(true);
        manager.startMusic();
        vi.advanceTimersByTime(FADE_IN_MS);
        manager.setMusicVolume(5);
        expect(manager.getMusicVolume()).toBe(1);
        expect(music().volume).toBe(1);
        manager.setMusicVolume(-3);
        expect(manager.getMusicVolume()).toBe(0);
        manager.setMusicVolume(Number.NaN);
        expect(manager.getMusicVolume()).toBe(0);
        manager.setMusicVolume(0.5);
        expect(music().volume).toBeCloseTo(0.5);
    });

    it.each(["hit", "sunk"] as const)("ducks the music under %s, then brings it back", (sound) =>
    {
        const manager = new AudioManager(true);
        manager.startMusic();
        vi.advanceTimersByTime(FADE_IN_MS);

        manager.play(sound);
        expect(music().volume).toBeCloseTo(0.2 * DUCK_LEVEL);
        vi.advanceTimersByTime(DUCK_MS - 1);
        expect(music().volume).toBeCloseTo(0.2 * DUCK_LEVEL);
        vi.advanceTimersByTime(1);
        expect(music().volume).toBeCloseTo(0.2);
    });

    it("keeps the duck going while shots keep landing", () =>
    {
        const manager = new AudioManager(true);
        manager.startMusic();
        vi.advanceTimersByTime(FADE_IN_MS);
        manager.play("hit");
        vi.advanceTimersByTime(DUCK_MS - 100);
        manager.play("hit");
        vi.advanceTimersByTime(DUCK_MS - 100);
        expect(music().volume).toBeCloseTo(0.2 * DUCK_LEVEL);
    });

    it.each(["miss", "tick", "turn", "error"] as const)("doesn't duck for %s", (sound) =>
    {
        const manager = new AudioManager(true);
        manager.startMusic();
        vi.advanceTimersByTime(FADE_IN_MS);
        manager.play(sound);
        expect(music().volume).toBeCloseTo(0.2);
    });

    it.each(["win", "lose"] as const)("fades the music out at game over, then plays %s", (sound) =>
    {
        const manager = new AudioManager(true);
        manager.startMusic();
        vi.advanceTimersByTime(FADE_IN_MS);

        manager.play(sound);
        expect(madeFor(sound)).toHaveLength(0);
        vi.advanceTimersByTime(FADE_OUT_MS);
        expect(music().volume).toBe(0);
        expect(music().paused).toBe(true);
        expect(madeFor(sound)[0].play).toHaveBeenCalledOnce();
    });

    it("plays win straight away when no music is playing", () =>
    {
        const manager = new AudioManager(true);
        manager.setMusicMuted(true);
        manager.play("win");
        expect(madeFor("win")[0].play).toHaveBeenCalledOnce();
    });

    it("still fades the music at game over when effects are muted", () =>
    {
        const manager = new AudioManager(true);
        manager.startMusic();
        vi.advanceTimersByTime(FADE_IN_MS);
        manager.setMuted(true);
        manager.play("lose");
        vi.advanceTimersByTime(FADE_OUT_MS);
        expect(music().paused).toBe(true);
        expect(madeFor("lose")).toHaveLength(0);
    });

    it("comes back with a fade in when the next game starts, from where it paused", () =>
    {
        const manager = new AudioManager(true);
        manager.startMusic();
        vi.advanceTimersByTime(FADE_IN_MS);
        manager.play("win");
        vi.advanceTimersByTime(FADE_OUT_MS);
        music().currentTime = 30;

        manager.startMusic();
        expect(music().paused).toBe(false);
        expect(music().currentTime).toBe(30);
        vi.advanceTimersByTime(FADE_IN_MS);
        expect(music().volume).toBeCloseTo(0.2);
    });

    it("pauses while the tab is hidden and resumes when it is visible", () =>
    {
        const manager = new AudioManager(true);
        manager.installUnlock();
        manager.startMusic();
        vi.advanceTimersByTime(FADE_IN_MS);

        doc.setHidden(true);
        expect(music().paused).toBe(true);
        doc.setHidden(false);
        expect(music().paused).toBe(false);
        expect(music().play).toHaveBeenCalledTimes(2);
    });

    it("stays paused on return to the tab if music was muted meanwhile", () =>
    {
        const manager = new AudioManager(true);
        manager.installUnlock();
        manager.startMusic();
        doc.setHidden(true);
        manager.setMusicMuted(true);
        doc.setHidden(false);
        expect(music().paused).toBe(true);
    });

    it("uses the AAC copy where Ogg can't play (older Safari)", () =>
    {
        FakeAudio.playable = ["audio/mp4"];
        new AudioManager(true).startMusic();
        expect(music().src).toBe("/music/battle-theme.m4a");
    });

    it("stays quiet without throwing when no music format can play", () =>
    {
        FakeAudio.playable = [];
        const manager = new AudioManager(true);
        expect(() => manager.startMusic()).not.toThrow();
        expect(musicMade()).toHaveLength(0);
        manager.play("hit");
        expect(madeFor("hit")[0].play).toHaveBeenCalledOnce();
    });

    it("plays no music while the flag is off", () =>
    {
        const manager = new AudioManager(false);
        manager.startMusic();
        manager.installUnlock();
        window.dispatchEvent(new Event("pointerdown"));
        expect(FakeAudio.made).toHaveLength(0);
    });
});
