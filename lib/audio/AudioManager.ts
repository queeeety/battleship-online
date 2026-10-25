import { AUDIO_ENABLED } from "../config/features";
import type { ShotResult } from "../enums";

export type SoundName = "hit" | "miss" | "sunk" | "tick" | "error";

/**
 * Plays game sounds.
 * Does nothing while AUDIO_ENABLED is false.
 */
export class AudioManager
{
    public play(sound: SoundName): void
    {
        if (!AUDIO_ENABLED) {
            return;
        }
        void sound;
        throw new Error("not yet");
    }

    public playForShot(result: ShotResult): void
    {
        void result;
        throw new Error("not yet");
    }
}
