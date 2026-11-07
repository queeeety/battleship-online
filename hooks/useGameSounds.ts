"use client";

import { useEffect, useRef } from "react";
import { audio, musicWanted, soundForUpdate, type SoundState } from "@/lib/audio";

/**
 * Plays one sound when a new game view arrives (shot or turn start), and plays the music during the battle.
 * Pass the page's PlayerView, or null while it is loading.
 */
export function useGameSounds(view: SoundState | null): void {
    // the last view we heard, so each update is compared with the one before it
    const previous = useRef<SoundState | null>(null);
    const inBattle = musicWanted(view);

    // the opponent's shots arrive without a click, so get the browser's permission on the first one
    useEffect(() => {
        audio.installUnlock();
    }, []);

    // music for the battle only: fades in when it starts, fades out when it ends or the page goes away.
    // the cleanup runs before the game-over sound below, so the fade comes first
    useEffect(() => {
        if (!inBattle) {
            return;
        }
        audio.startMusic();
        return () => audio.stopMusic();
    }, [inBattle]);

    useEffect(() => {
        if (view === null) {
            // the next view counts as a first load again, so old shots stay silent
            previous.current = null;
            return;
        }
        const sound = soundForUpdate(previous.current, view);
        if (sound !== null) {
            audio.play(sound);
        }
        previous.current = view;
    }, [view]);
}
