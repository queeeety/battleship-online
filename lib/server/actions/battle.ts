"use server";

import { Server, NotSeatedError, RateLimitedError } from "../../controllers/Server";
import type { PlayerView, ShotView } from "../../controllers/Server";
import type { RematchStatus } from "../../enums";
import { MoveRefusedError, StaleGameError } from "../GameRepository";
import { InvalidRequestError } from "../RequestValidator";

/** Battle actions for the screens. */

export type BattleFailure = "NOT_SEATED" | "INVALID_INPUT" | "MOVE_REFUSED" | "STALE" | "RATE_LIMITED" | "SERVER_ERROR";

export type BattleResult<T> = { ok: true; data: T } | { ok: false; error: BattleFailure; message?: string };

/** `layout` is { ships: [...] }, as from Board.toSnapshot(). */
export async function placeShips(code: string, layout: unknown): Promise<BattleResult<null>>
{
    return run(async server => { await server.placeShips(code, layout); return null; });
}

export async function fireShot(code: string, target: { row: number; col: number }): Promise<BattleResult<ShotView>>
{
    return run(async server =>
    {
        const shot = await server.fireShot(code, target);
        return { ...shot.getCoordinate().toRowCol(), result: shot.getResult(), sunkShipName: shot.getSunkShipName() };
    });
}

export async function forfeit(code: string): Promise<BattleResult<null>>
{
    return run(async server => { await server.forfeit(code); return null; });
}

export async function getMyState(code: string): Promise<BattleResult<PlayerView>>
{
    return run(server => server.getMyState(code));
}

/** Rematch or Accept sends true; Decline or Home sends false, which closes the lobby. */
export async function requestRematch(code: string, accept: boolean): Promise<BattleResult<RematchStatus>>
{
    return run(async server => (await server.requestRematch(code, accept)).getStatus());
}

/** Called by NetworkHandler when the opponent's presence drops. */
export async function reportDisconnect(code: string): Promise<BattleResult<null>>
{
    return run(async server => { await server.reportDisconnect(code); return null; });
}

/** true if time was really up and the server acted; false means ask again in a second. */
export async function claimTimeout(code: string): Promise<BattleResult<boolean>>
{
    return run(server => server.claimTimeout(code));
}

/** The waiting host's heartbeat, sent by NetworkHandler. */
export async function keepLobbyOpen(code: string): Promise<BattleResult<boolean>>
{
    return run(server => server.keepLobbyOpen(code));
}

async function run<T>(fn: (server: Server) => Promise<T>): Promise<BattleResult<T>>
{
    try
    {
        return { ok: true, data: await fn(await Server.create()) };
    }
    catch (e)
    {
        if (e instanceof NotSeatedError) return { ok: false, error: "NOT_SEATED" };
        if (e instanceof InvalidRequestError) return { ok: false, error: "INVALID_INPUT", message: e.message };
        if (e instanceof MoveRefusedError) return { ok: false, error: "MOVE_REFUSED", message: e.message };
        if (e instanceof StaleGameError) return { ok: false, error: "STALE" };
        if (e instanceof RateLimitedError) return { ok: false, error: "RATE_LIMITED" };
        console.error(e);
        return { ok: false, error: "SERVER_ERROR" };
    }
}
