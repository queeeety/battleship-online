import { GameType } from "../enums";

/**
 * The game's rule numbers in one place.
 * Change a rule here instead of hunting for it across the classes.
 */

export const BOARD_SIZE = 10;

export const MAX_PLAYERS = 2;

// seconds per turn for each game type
export const TURN_TIME_LIMIT_SECONDS: Readonly<Record<GameType, number>> = {
    [GameType.BEGINNER]: 30,
    [GameType.ORIGINAL]: 15,
    [GameType.QUICK_FIRE]: 5
};

// how long before a disconnect counts as a forfeit
export const DISCONNECT_GRACE_PERIOD_MS = 60000;

// no 0, O, 1, I or L so codes can be read out loud without mistakes
export const LOBBY_CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const LOBBY_CODE_LENGTH = 6;

// blank names get a random one, otherwise 1-16 chars
export const PLAYER_NAME_MAX_LENGTH = 16;
