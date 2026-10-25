import { AudioManager } from "./AudioManager";

export * from "./AudioManager";

// one shared instance so every component uses the same flag check
export const audio = new AudioManager();
