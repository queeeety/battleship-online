"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import type { ReactElement } from "react";
import { Button } from "@/components/ui";
import { audio, soundSettings, type SoundSettings } from "@/lib/audio";
import { AUDIO_ENABLED } from "@/lib/config/features";

type Channel = "effects" | "music";

const CHANNELS: ReadonlyArray<{ channel: Channel; label: string }> = [
    { channel: "effects", label: "Sound effects" },
    { channel: "music", label: "Music" }
];

/** The settings change for flipping one channel's switch; pure so it can be tested. */
export function toggleChannel(settings: SoundSettings, channel: Channel): Partial<SoundSettings>
{
    return channel === "effects" ? { effectsMuted: !settings.effectsMuted } : { musicMuted: !settings.musicMuted };
}

/** The settings change for a slider at percent (0..100). */
export function volumeChange(channel: Channel, percent: number): Partial<SoundSettings>
{
    const volume = percent / 100;
    return channel === "effects" ? { effectsVolume: volume } : { musicVolume: volume };
}

/** True when this key or press should close the open menu. */
export function closesMenu(key: string): boolean
{
    return key === "Escape";
}

function channelState(settings: SoundSettings, channel: Channel): { on: boolean; percent: number }
{
    return channel === "effects"
        ? { on: !settings.effectsMuted, percent: Math.round(settings.effectsVolume * 100) }
        : { on: !settings.musicMuted, percent: Math.round(settings.musicVolume * 100) };
}

// same look as components/ui/Icon; drawn here because the shared set has no speaker
function SpeakerIcon({ muted }: { muted: boolean }): ReactElement
{
    return (
        <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}
            strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 9h4l5-4v14l-5-4H4z" />
            {muted ? <path d="M17 9l5 6M22 9l-5 6" /> : <path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" />}
        </svg>
    );
}

export interface SoundPanelProps
{
    id: string;
    open: boolean;
    settings: SoundSettings;
    onChange: (change: Partial<SoundSettings>) => void;
}

/** The popover's contents: an on/off switch and a volume slider for effects and for music. */
export function SoundPanel({ id, open, settings, onChange }: SoundPanelProps): ReactElement
{
    // always in the page so the button's aria-controls points at something; hidden while closed
    return (
        <div id={id} hidden={!open} role="group" aria-label="Sound settings"
            className="absolute top-full [&[hidden]]:hidden right-0 z-(--z-overlay) mt-(--space-2) grid w-[min(18rem,calc(100vw-2rem))] gap-(--space-3) rounded-(--radius-lg) border border-line-control bg-surface-100 p-(--space-4) text-ink shadow-(--shadow-overlay)">
            {CHANNELS.map(({ channel, label }) => {
                const { on, percent } = channelState(settings, channel);
                return (
                    <div key={channel} className="grid gap-(--space-1)">
                        <button type="button" role="switch" aria-checked={on}
                            onClick={() => onChange(toggleChannel(settings, channel))}
                            className="flex min-h-11 items-center justify-between gap-(--space-3) rounded-(--radius-md) text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">
                            <span>{label}</span>
                            {/* the switch: track and thumb; "On"/"Off" is written too, so it isn't colour alone */}
                            <span className="flex items-center gap-(--space-2) text-ink-muted">
                                <span className="mb-label">{on ? "On" : "Off"}</span>
                                <span aria-hidden="true" className={`relative h-5 w-9 rounded-(--radius-full) border border-line-control ${on ? "bg-sonar" : "bg-surface-000"}`}>
                                    <span className={`absolute top-0.5 h-3.5 w-3.5 rounded-(--radius-full) transition-[left] duration-(--mb-dur-1) motion-reduce:transition-none ${on ? "left-[18px] bg-on-sonar" : "left-0.5 bg-ink-muted"}`} />
                                </span>
                            </span>
                        </button>
                        <input type="range" min={0} max={100} step={5} value={percent}
                            aria-label={`${label} volume`} aria-valuetext={`${percent}%`}
                            onChange={(event) => onChange(volumeChange(channel, Number(event.target.value)))}
                            className="min-h-11 w-full accent-(--sonar) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus" />
                    </div>
                );
            })}
        </div>
    );
}

/** Speaker button that opens the Sound menu. Hidden while audio is off. */
export function SoundMenu(): ReactElement | null
{
    const settings = useSyncExternalStore(soundSettings.subscribe, soundSettings.get, soundSettings.getServer);
    const [open, setOpen] = useState(false);
    const panelId = useId();
    const wrapper = useRef<HTMLDivElement>(null);
    const button = useRef<HTMLButtonElement>(null);

    // the first click on any screen with this menu unlocks sound, so the battle music can start later
    useEffect(() => {
        audio.installUnlock();
    }, []);

    // while open: Escape closes and returns focus to the button; a press outside just closes
    useEffect(() => {
        if (!open) {
            return;
        }
        const onKey = (event: KeyboardEvent): void => {
            if (closesMenu(event.key)) {
                setOpen(false);
                button.current?.focus();
            }
        };
        const onPress = (event: PointerEvent): void => {
            if (!wrapper.current?.contains(event.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener("keydown", onKey);
        document.addEventListener("pointerdown", onPress);
        return () => {
            document.removeEventListener("keydown", onKey);
            document.removeEventListener("pointerdown", onPress);
        };
    }, [open]);

    if (!AUDIO_ENABLED) {
        return null;
    }

    const allMuted = settings.effectsMuted && settings.musicMuted;
    return (
        <div ref={wrapper} className="relative">
            <Button ref={button} variant="ghost" size="sm" aria-label="Sound" aria-expanded={open} aria-controls={panelId}
                title={allMuted ? "Sound off" : "Sound"} onClick={() => setOpen(!open)} className="min-h-11 min-w-11">
                <SpeakerIcon muted={allMuted} />
            </Button>
            <SoundPanel id={panelId} open={open} settings={settings} onChange={(change) => soundSettings.update(change)} />
        </div>
    );
}
