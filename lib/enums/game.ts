/**
 * Enums for a match - its state, type, shots, how it ended and rematches.
 */

export enum GameState
{
    PLACEMENT,
    IN_PROGRESS,
    FINISHED
}

// turn limits for each type live in config/gameRules.ts
export enum GameType
{
    BEGINNER,
    ORIGINAL,
    QUICK_FIRE
}

export enum ShotResult
{
    MISS,
    HIT,
    SUNK
}

export enum EndReason
{
    FLEET_DESTROYED,
    OPPONENT_FORFEIT,
    OPPONENT_DISCONNECTED
}

export enum RematchStatus
{
    NONE,
    REQUESTED,
    ACCEPTED,
    DECLINED
}

