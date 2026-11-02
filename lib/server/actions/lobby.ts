"use server";

import { Server, JoinRefusedError, RateLimitedError } from "../../controllers/Server";
import type { Lobby } from "../../controllers/Lobby";
import type { HumanPlayer } from "../../entities/players";
import { JoinError } from "../../enums";

/**
 * Server actions for Stage 4: the functions the lobby screens call.
 * Each one runs on the server, builds a Server for this request and turns its result
 * (or its refusal) into plain data the browser can use. Class instances can't cross
 * from server to browser, so only plain objects are returned.
 */

export type LobbyFailure = JoinError | "RATE_LIMITED" | "SERVER_ERROR";

export type LobbyResult =
    | { ok: true; code: string; shareLink: string; seat: 1 | 2; name: string; sessionId: string }
    | { ok: false; error: LobbyFailure };

/** Create Lobby button. `type` is a GameType value. The caller becomes the host in seat 1. */
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

/** Join Lobby button, or opening a /game/[code] link. The caller becomes the guest in seat 2. */
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

/**
 * On page load: puts a player who refreshed back in their seat, matched by their session cookie.
 * Returns null if they aren't seated in any game that's still going.
 */
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

/** The plain-data version of "this player sits in this lobby". */
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

/** Expected refusals go back to the screen as-is; anything unexpected is logged and hidden. */
function failure(e: unknown): LobbyFailure
{
    if (e instanceof JoinRefusedError) return e.reason;
    if (e instanceof RateLimitedError) return "RATE_LIMITED";
    console.error(e);
    return "SERVER_ERROR";
}
