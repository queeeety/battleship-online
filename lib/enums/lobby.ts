/**
 * Enums for lobbies and joining them.
 */

export enum LobbyStatus
{
    WAITING,
    IN_PROGRESS,
    FINISHED,
    ABANDONED
}

export enum JoinError
{
    CODE_NOT_FOUND,
    LOBBY_FULL,
    GAME_ALREADY_FINISHED,
    INVALID_NAME
}
