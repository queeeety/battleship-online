import { AudioManager } from "./AudioManager";

export * from "./AudioManager";
export * from "./soundForUpdate";

// one shared instance so every component uses the same flag check
export const audio = new AudioManager();
