/**
 * Feature flags.
 * Audio is off until the sound layer ships.
 */

// typed boolean so `if (AUDIO_ENABLED)` is not flagged as a constant condition
export const AUDIO_ENABLED: boolean = false;
