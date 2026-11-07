import { AudioManager } from "./AudioManager";
import { browserStorage } from "./muteStorage";
import { SoundSettingsStore } from "./soundSettings";

export * from "./AudioManager";
export * from "./soundForUpdate";
export type { SoundSettings } from "./soundSettings";

// one shared instance so every component uses the same flag check, and the music never restarts
export const audio = new AudioManager();

// what the Sound menu reads and changes; saving goes to localStorage
export const soundSettings = new SoundSettingsStore(audio, browserStorage);
