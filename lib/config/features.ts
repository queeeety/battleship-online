/**
 * Feature flags.
 * Audio is on by default; players can mute it with MuteToggle, and the choice is saved.
 */

// typed boolean so `if (AUDIO_ENABLED)` is not flagged as a constant condition
export const AUDIO_ENABLED: boolean = true;
