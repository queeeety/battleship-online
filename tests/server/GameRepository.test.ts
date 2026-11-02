import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { GameRepository } from "../../lib/server/GameRepository";
import { Lobby } from "../../lib/controllers/Lobby";
import { GameState, GameType, LobbyStatus } from "../../lib/enums";

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
