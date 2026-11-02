"use server";

import { Server, NotSeatedError } from "../../controllers/Server";
import type { PlayerView, ShotView } from "../../controllers/Server";
import { MoveRefusedError, StaleGameError } from "../GameRepository";
import { InvalidRequestError } from "../RequestValidator";

/** Battle actions for the screens. After any of them, the broadcast tells both players to refresh. */

export type BattleFailure = "NOT_SEATED" | "INVALID_INPUT" | "MOVE_REFUSED" | "STALE" | "SERVER_ERROR";

export type BattleResult<T> = { ok: true; data: T } | { ok: false; error: BattleFailure; message?: string };

/** `layout` is { ships: [{ name, row, col, orientation }] }, the same shape as Board.toSnapshot(). */
export async function placeShips(code: string, layout: unknown): Promise<BattleResult<null>>
{
    return run(async server => { await server.placeShips(code, layout); return null; });
}

/** `target` is { row, col }, both 0 to 9. */
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

/** Call on load, on reconnect, and whenever a game_updated broadcast arrives. */
export async function getMyState(code: string): Promise<BattleResult<PlayerView>>
{
    return run(server => server.getMyState(code));
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
        // someone else's move landed first: refresh with getMyState and try again
        if (e instanceof StaleGameError) return { ok: false, error: "STALE" };
        console.error(e);
        return { ok: false, error: "SERVER_ERROR" };
    }
}
