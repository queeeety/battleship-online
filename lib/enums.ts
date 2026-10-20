/**
 * All the enums used across the game.
 * Kept in one file since they're just lists of values.
 */

export enum GameState
{
    PLACEMENT,
    IN_PROGRESS,
    FINISHED
}

export enum GameType
{
    BEGINNER,   // 30s per turn
    ORIGINAL,   // 15s per turn
    QUICK_FIRE  // 5s per turn
}

export enum LobbyStatus
{
    WAITING,
    IN_PROGRESS,
    FINISHED,
    ABANDONED
}

export enum CellState
{
    EMPTY,
    OCCUPIED,
    HIT,
    MISS
}

export enum ShotResult
{
    MISS,
    HIT,
    SUNK
}

export enum Orientation
{
    HORIZONTAL,
    VERTICAL
}

export enum Difficulty
{
    EASY,
    NORMAL
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

export enum JoinError
{
    CODE_NOT_FOUND,
    LOBBY_FULL,
    GAME_ALREADY_FINISHED,
    INVALID_NAME
}

export enum PlacementError
{
    OUT_OF_BOUNDS,
    OVERLAPS_SHIP,
    ALREADY_PLACED,
    FLEET_INCOMPLETE
}

export enum Screen
{
    HOME,
    LOBBY,
    PLACEMENT,
    BATTLE,
    RESULT
}
