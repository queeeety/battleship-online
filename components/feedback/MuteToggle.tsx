"use client";

import { useEffect, useSyncExternalStore } from "react";
import type { ReactElement } from "react";
import { AUDIO_ENABLED } from "@/lib/config/features";
import { audio } from "@/lib/audio";
import { browserStorage, loadMuted, saveMuted } from "@/lib/audio/muteStorage";

// this visit's choice; kept here too so the toggle still works if storage can't be written
let chosen: boolean | null = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

function getMuted(): boolean {
    return chosen ?? loadMuted(browserStorage(), false);
}

// the server can't see localStorage, so it always renders unmuted
function getServerMuted(): boolean {
    return false;
}

function setChosen(muted: boolean): void {
    chosen = muted;
    saveMuted(browserStorage(), muted);
    listeners.forEach((listener) => listener());
}

// same look as components/ui/Icon; drawn here because the shared set has no speaker
function SpeakerIcon({ muted }: { muted: boolean }): ReactElement {
    return (
        <svg
            width={20}
            height={20}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <path d="M4 9h4l5-4v14l-5-4H4z" />
            {muted ? (
                <path d="M17 9l5 6M22 9l-5 6" />
            ) : (
                <path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" />
            )}
        </svg>
    );
}

/** Mutes or unmutes game sounds and remembers the choice. Hidden while audio is off. */
export function MuteToggle(): ReactElement | null {
    const muted = useSyncExternalStore(subscribe, getMuted, getServerMuted);

    // keep the shared AudioManager in step, including the saved choice on load
    useEffect(() => {
        audio.setMuted(muted);
    }, [muted]);

    if (!AUDIO_ENABLED) {
        return null;
    }

    return (
        <button
            type="button"
            onClick={() => setChosen(!muted)}
            aria-label="Mute sounds"
            aria-pressed={muted}
            title={muted ? "Sound off" : "Sound on"}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
        >
            <SpeakerIcon muted={muted} />
        </button>
    );
}
