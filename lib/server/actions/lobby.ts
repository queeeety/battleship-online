"use server";

import { Server, JoinRefusedError, RateLimitedError } from "../../controllers/Server";
import type { Lobby } from "../../controllers/Lobby";
import type { HumanPlayer } from "../../entities/players";
import { JoinError } from "../../enums";

/** Lobby actions for the screens. They return plain data, since class instances can't reach the browser. */

export type LobbyFailure = JoinError | "RATE_LIMITED" | "SERVER_ERROR";

export type LobbyResult =
    | { ok: true; code: string; shareLink: string; seat: 1 | 2; name: string; sessionId: string }
    | { ok: false; error: LobbyFailure };

/** `type` is a GameType value. */
export async function createLobby(name: string, type: number): Promise<LobbyResult>
{
    try
    {
        const lobby = await (await Server.create()).createLobby(name, type);
        return seated(lobby, lobby.getPlayers()[0]);
    }
    catch (e)
    {
        return { ok: false, error: failure(e) };
    }
}

export async function joinLobby(code: string, name: string): Promise<LobbyResult>
{
    try
    {
        const { lobby, player } = await (await Server.create()).joinLobby(code, name);
        return seated(lobby, player);
    }
    catch (e)
    {
        return { ok: false, error: failure(e) };
    }
}

/** Call on page load. Null if the player has no active seat. */
export async function restoreSeat(sessionId?: string): Promise<LobbyResult | null>
{
    try
    {
        const restored = await (await Server.create()).restoreSeat(sessionId);
        return restored === null ? null : seated(restored.lobby, restored.player);
    }
    catch (e)
    {
        return { ok: false, error: failure(e) };
    }
}

function seated(lobby: Lobby, player: HumanPlayer): LobbyResult
{
    return {
        ok: true,
        code: lobby.getCode(),
        shareLink: lobby.shareLink(),
        seat: lobby.seatOf(player.getSessionId()) ?? 1,
        name: player.getName(),
        sessionId: player.getSessionId()
    };
}

// unexpected errors are logged, not shown to the player
function failure(e: unknown): LobbyFailure
{
    if (e instanceof JoinRefusedError) return e.reason;
    if (e instanceof RateLimitedError) return "RATE_LIMITED";
    console.error(e);
    return "SERVER_ERROR";
}
