import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { GameRepository, StaleGameError } from "../../lib/server/GameRepository";
import { Lobby } from "../../lib/controllers/Lobby";
import type { Game } from "../../lib/controllers/Game";
import { GameState, GameType, LobbyStatus, ShotResult } from "../../lib/enums";
import { HumanPlayer } from "../../lib/entities/players";
import { startedGame, knownFleetSquares, OPEN_WATER, sinkDestroyer } from "../helpers";
import { fakeSupabase } from "./fakeSupabase";

/** A games row as Supabase would return it, with a host and no guest by default. */
function row(overrides: Record<string, unknown> = {})
{
    return {
        code: "4F7K2M",
        lobby_status: "waiting",
        game_type: "original",
        game_state: null,
        player1_id: "host-session",
        player1_name: "Cian91",
        player2_id: null,
        player2_name: null,
        ready_p1: false,
        ready_p2: false,
        disconnected_at_p1: null,
        disconnected_at_p2: null,
        created_at: "2026-11-02T12:00:00Z",
        updated_at: "2026-11-02T12:00:10Z",
        ...overrides
    };
}

/** A fake client: `found` is what a select returns; upsert calls are recorded for checking. */
function fakeClient(found: object | null = null, upsertError: { message: string } | null = null)
{
    const upsert = vi.fn().mockResolvedValue({ error: upsertError });
    const query = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: found, error: null })
    };
    const client = { from: vi.fn().mockReturnValue({ ...query, upsert }) } as unknown as SupabaseClient;
    return { client, upsert };
}

describe("GameRepository.loadLobby", () =>
{
    it("returns null when no row has the code", async () =>
    {
        const repo = new GameRepository(fakeClient(null).client);
        expect(await repo.loadLobby("4F7K2M")).toBeNull();
    });

    it("rebuilds a waiting lobby with just the host", async () =>
    {
        const lobby = await new GameRepository(fakeClient(row()).client).loadLobby("4F7K2M");
        expect(lobby?.getCode()).toBe("4F7K2M");
        expect(lobby?.getStatus()).toBe(LobbyStatus.WAITING);
        expect(lobby?.getGameType()).toBe(GameType.ORIGINAL);
        expect(lobby?.getPlayers()).toHaveLength(1);
        expect(lobby?.seatOf("host-session")).toBe(1);
        expect(lobby?.isJoinable()).toBe(true);
    });

    it("rebuilds a full lobby with both seats, ready flags and the quickfire type", async () =>
    {
        const found = row({
            lobby_status: "in_progress", game_type: "quickfire", game_state: "placement",
            player2_id: "guest-session", player2_name: "Player482", ready_p2: true
        });
        const lobby = await new GameRepository(fakeClient(found).client).loadLobby("4F7K2M");
        expect(lobby?.getStatus()).toBe(LobbyStatus.IN_PROGRESS);
        expect(lobby?.getGameType()).toBe(GameType.QUICK_FIRE);
        expect(lobby?.seatOf("guest-session")).toBe(2);
        expect(lobby?.getPlayers()[1].getIsReady()).toBe(true);
        expect(lobby?.getPlayers()[0].getIsReady()).toBe(false);
    });

    it("restores a disconnect time so the forfeit clock carries on", async () =>
    {
        const found = row({ disconnected_at_p1: "2026-11-02T12:00:00Z" });
        const lobby = await new GameRepository(fakeClient(found).client).loadLobby("4F7K2M");
        const host = lobby!.getPlayers()[0];
        expect(host.isConnected()).toBe(false);
        expect(host.getDisconnectedAt()).toEqual(new Date("2026-11-02T12:00:00Z"));
    });

    it("refuses a value the enums don't know", async () =>
    {
        const repo = new GameRepository(fakeClient(row({ lobby_status: "sideways" })).client);
        await expect(repo.loadLobby("4F7K2M")).rejects.toThrow("sideways");
    });
});

describe("GameRepository.saveLobby", () =>
{
    it("writes a waiting lobby with the host and no game state yet", async () =>
    {
        const { client, upsert } = fakeClient();
        const lobby = new Lobby(GameType.BEGINNER, "4F7K2M");
        lobby.join("Cian91", "host-session");

        await new GameRepository(client).saveLobby(lobby);

        const [written, options] = upsert.mock.calls[0];
        expect(options).toEqual({ onConflict: "code" });
        expect(written).toMatchObject({
            code: "4F7K2M", lobby_status: "waiting", game_type: "beginner", game_state: null,
            player1_id: "host-session", player1_name: "Cian91", player2_id: null, player2_name: null
        });
    });

    it("writes both seats and placement once the guest has joined", async () =>
    {
        const { client, upsert } = fakeClient();
        const lobby = new Lobby(GameType.ORIGINAL, "4F7K2M");
        lobby.join("Cian91", "host-session");
        lobby.join("Player482", "guest-session");

        await new GameRepository(client).saveLobby(lobby);

        expect(upsert.mock.calls[0][0]).toMatchObject({
            lobby_status: "in_progress", game_state: "placement",
            player2_id: "guest-session", player2_name: "Player482"
        });
        expect(lobby.getGame().getState()).toBe(GameState.PLACEMENT);
    });

    it("refuses to save a lobby with nobody in it", async () =>
    {
        const repo = new GameRepository(fakeClient().client);
        await expect(repo.saveLobby(new Lobby(GameType.ORIGINAL))).rejects.toThrow();
    });

    it("passes on a database error", async () =>
    {
        const { client } = fakeClient(null, { message: "duplicate key" });
        const lobby = new Lobby(GameType.ORIGINAL, "4F7K2M");
        lobby.join("Cian91", "host-session");
        await expect(new GameRepository(client).saveLobby(lobby)).rejects.toThrow("duplicate key");
    });
});

// ---------------------------------------------------------------- running games

/**
 * A one-game fake database: a games row and a game_secrets row, plus a save_game
 * that behaves like the real one (only writes if updated_at still matches).
 */
function fakeGameDb()
{
    let clock = 0;
    const db = {
        game: {
            ...row({ lobby_status: "in_progress", game_state: "placement", player1_id: "session-Aoife", player1_name: "Aoife", player2_id: "session-Cian", player2_name: "Cian" }),
            turn: null, turn_started_at: null, double_shot_active: false, winner: null, end_reason: null, finished_at: null,
            shots_p1: [], shots_p2: [], ability_p1: null, ability_p2: null, offered_ability_p1: null, offered_ability_p2: null,
            updated_at: "v0"
        } as Record<string, unknown>,
        secrets: null as { board_p1: unknown; board_p2: unknown } | null,
        // set to simulate another request saving between this request's load and save
        concurrentWrite: false
    };
    const select = (table: string) =>
    {
        const query = {
            select: () => query,
            eq: () => query,
            maybeSingle: async () => ({ data: table === "games" ? { ...db.game } : db.secrets, error: null })
        };
        return query;
    };
    const client = {
        from: vi.fn((table: string) => select(table)),
        rpc: vi.fn(async (_name: string, args: Record<string, unknown>) =>
        {
            if (db.concurrentWrite) db.game.updated_at = "someone-else";
            if (db.game.updated_at !== args.p_expected_updated_at) return { data: null, error: null };
            Object.assign(db.game, args.p_game, { updated_at: `v${++clock}` });
            db.secrets = { board_p1: args.p_board_p1, board_p2: args.p_board_p2 };
            return { data: db.game.updated_at, error: null };
        })
    } as unknown as SupabaseClient;
    return { db, repo: new GameRepository(client) };
}

describe("GameRepository.loadGame / saveGame", () =>
{
    it("has no game to load while the lobby is still waiting", async () =>
    {
        const { db, repo } = fakeGameDb();
        Object.assign(db.game, { game_state: null, player2_id: null, player2_name: null });
        expect(await repo.loadGame("4F7K2M")).toBeNull();
    });

    it("saves a game and loads back the same state", async () =>
    {
        const { db, repo } = fakeGameDb();
        const { game, first } = startedGame();
        game.fireShot(first, knownFleetSquares()[0]);           // a hit, so first keeps the turn
        game.fireShot(first, OPEN_WATER);                        // a miss, the turn passes

        const version = await repo.saveGame(game, "v0");
        expect(version).toBe("v1");

        const firstSeat = game.getPlayers().indexOf(first);
        expect(db.game[`shots_p${firstSeat + 1}`]).toMatchObject([{ row: 0, col: 0, result: "hit" }, { row: 9, col: 9, result: "miss" }]);
        expect(db.game.turn).toBe(2 - firstSeat);

        const loaded = await repo.loadGame("4F7K2M");
        expect(loaded?.version).toBe("v1");
        const g = loaded!.game;
        expect(g.getState()).toBe(GameState.IN_PROGRESS);
        expect(g.getShots().map(s => s.getResult())).toEqual([ShotResult.HIT, ShotResult.MISS]);
        expect(g.getPlayers().indexOf(g.getCurrentTurn()!)).toBe(1 - firstSeat);
        expect(g.opponentOf(g.getPlayers()[firstSeat]).getBoard().hasBeenTargeted(knownFleetSquares()[0])).toBe(true);
        expect((g.getPlayers()[0] as HumanPlayer).getSessionId()).toBe("session-Aoife");
    });

    it("stores abilities by database key and loads them back by name", async () =>
    {
        const { db, repo } = fakeGameDb();
        const { game, first, second } = startedGame();
        sinkDestroyer(game, first);                              // second loses a ship and draws an ability

        await repo.saveGame(game, "v0");
        const seat = game.getPlayers().indexOf(second) + 1;
        expect(["double_shot", "radar_sweep", "line_scan", "reroute"]).toContain(db.game[`ability_p${seat}`]);

        const loaded = await repo.loadGame("4F7K2M");
        expect(loaded!.game.getPlayers()[seat - 1].getHeldAbility()?.getName()).toBe(second.getHeldAbility()?.getName());
    });

    it("refuses a save against an old version and writes nothing", async () =>
    {
        const { db, repo } = fakeGameDb();
        const { game } = startedGame();
        await repo.saveGame(game, "v0");
        const before = { ...db.game };

        expect(await repo.saveGame(game, "v0")).toBeNull();
        expect(db.game).toEqual(before);
    });

    it("restores a disconnect time on the right player", async () =>
    {
        const { db, repo } = fakeGameDb();
        await repo.saveGame(startedGame().game, "v0");
        db.game.disconnected_at_p2 = "2026-11-02T12:00:00Z";

        const players = (await repo.loadGame("4F7K2M"))!.game.getPlayers() as HumanPlayer[];
        expect(players[0].isConnected()).toBe(true);
        expect(players[1].getDisconnectedAt()).toEqual(new Date("2026-11-02T12:00:00Z"));
    });

    it("saves a disconnect time and clears it once the player is back", async () =>
    {
        const { db, repo } = fakeGameDb();
        const { game } = startedGame();
        const guest = game.getPlayers()[1] as HumanPlayer;
        guest.disconnect(new Date("2026-11-03T12:00:00Z"));
        await repo.saveGame(game, "v0");
        expect(db.game.disconnected_at_p1).toBeNull();
        expect(db.game.disconnected_at_p2).toBe("2026-11-03T12:00:00.000Z");

        guest.reconnect();
        await repo.saveGame(game, "v1");
        expect(db.game.disconnected_at_p2).toBeNull();
    });
});

describe("GameRepository.runShotTransaction", () =>
{
    async function startedInDb()
    {
        const setup = fakeGameDb();
        await setup.repo.saveGame(startedGame().game, "v0");
        const game = (await setup.repo.loadGame("4F7K2M"))!.game;
        return { ...setup, shooter: game.getCurrentTurn()!, waiting: game.opponentOf(game.getCurrentTurn()!) };
    }

    it("fires, saves and returns the shot", async () =>
    {
        const { repo, shooter } = await startedInDb();
        const shot = await repo.runShotTransaction("4F7K2M", shooter, knownFleetSquares()[0]);
        expect(shot.getResult()).toBe(ShotResult.HIT);
        expect((await repo.loadGame("4F7K2M"))!.game.getShots()).toHaveLength(1);
    });

    it("refuses a shot from the player whose turn it isn't", async () =>
    {
        const { repo, waiting } = await startedInDb();
        await expect(repo.runShotTransaction("4F7K2M", waiting, OPEN_WATER)).rejects.toThrow("turn");
    });

    it("saves what beforeShot changed even when the shot itself is refused", async () =>
    {
        const { db, repo, shooter } = await startedInDb();
        const seat = (await repo.loadGame("4F7K2M"))!.game.getPlayers().findIndex(p => p.getId() === shooter.getId()) + 1;
        const missFirst = (g: Game) =>
        {
            g.fireShot(g.getCurrentTurn()!, OPEN_WATER);       // the turn passes, so `shooter` is then refused
            return true;
        };
        await expect(repo.runShotTransaction("4F7K2M", shooter, knownFleetSquares()[0], missFirst)).rejects.toThrow("turn");
        expect(db.game[`shots_p${seat}`]).toMatchObject([{ row: 9, col: 9, result: "miss" }]);
    });

    it("throws StaleGameError if another request saved first, and writes nothing", async () =>
    {
        const { db, repo, shooter } = await startedInDb();
        db.concurrentWrite = true;
        await expect(repo.runShotTransaction("4F7K2M", shooter, OPEN_WATER)).rejects.toBeInstanceOf(StaleGameError);
        expect(db.game.shots_p1).toEqual([]);
        expect(db.game.shots_p2).toEqual([]);
    });
});

describe("GameRepository.keepLobbyOpen", () =>
{
    it("moves a waiting lobby's updated_at on, and says false once it isn't waiting", async () =>
    {
        const db = fakeSupabase();
        const repo = new GameRepository(db.client);
        const lobby = new Lobby(GameType.ORIGINAL, "4F7K2M");
        lobby.join("Cian91", "host-session");
        await repo.saveLobby(lobby);
        const before = db.games.get("4F7K2M")!.updated_at;

        expect(await repo.keepLobbyOpen("4F7K2M")).toBe(true);
        expect(db.games.get("4F7K2M")!.updated_at).not.toBe(before);

        lobby.join("Aoife", "guest-session");
        await repo.saveLobby(lobby);
        expect(await repo.keepLobbyOpen("4F7K2M")).toBe(false);
    });

    it("loads the last check-in as the lobby's lastSeenAt", async () =>
    {
        const { client } = fakeClient(row());
        const lobby = (await new GameRepository(client).loadLobby("4F7K2M"))!;
        expect(lobby.getLastSeenAt()).toEqual(new Date("2026-11-02T12:00:10Z"));
    });
});
