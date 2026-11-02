import { describe, it, expect, vi } from "vitest";
import { Server, JoinRefusedError, RateLimitedError } from "../../lib/controllers/Server";
import { Lobby } from "../../lib/controllers/Lobby";
import type { SessionManager } from "../../lib/server/SessionManager";
import type { GameRepository } from "../../lib/server/GameRepository";
import type { RateLimiter } from "../../lib/server/RateLimiter";
import { GameState, GameType, JoinError, LobbyStatus } from "../../lib/enums";

/**
 * Builds a Server around fakes: `caller` is whose cookie the request carries (null = first visit),
 * lobbies live in a Map instead of the database, and the rate limit allows everything unless told not to.
 */
function setup(caller: string | null, opts: { allow?: boolean } = {})
{
    const lobbies = new Map<string, Lobby>();
    const sessions = {
        currentSessionId: vi.fn().mockResolvedValue(caller),
        signInAnonymously: vi.fn().mockResolvedValue("new-session")
    } as unknown as SessionManager;
    const repo = {
        loadLobby: vi.fn(async (code: string) => lobbies.get(code) ?? null),
        saveLobby: vi.fn(async (l: Lobby) => { lobbies.set(l.getCode(), l); }),
        findActiveLobbyCode: vi.fn(async (sessionId: string) =>
        {
            for (const l of lobbies.values())
            {
                const live = l.getStatus() === LobbyStatus.WAITING || l.getStatus() === LobbyStatus.IN_PROGRESS;
                if (live && l.seatOf(sessionId) !== null) return l.getCode();
            }
            return null;
        })
    } as unknown as GameRepository;
    const limiter = { allow: vi.fn().mockResolvedValue(opts.allow ?? true) } as unknown as RateLimiter;
    return { server: new Server(sessions, repo, limiter), lobbies, sessions, repo };
}

/** A waiting lobby with the host already seated, stored in the fake database. */
function hostedLobby(lobbies: Map<string, Lobby>, code = "4F7K2M"): Lobby
{
    const lobby = new Lobby(GameType.ORIGINAL, code);
    lobby.join("Cian91", "host-session");
    lobbies.set(code, lobby);
    return lobby;
}

/** The JoinError a call was refused with. */
async function refusal(p: Promise<unknown>): Promise<JoinError>
{
    try { await p; }
    catch (e) { if (e instanceof JoinRefusedError) return e.reason; throw e; }
    throw new Error("expected a JoinRefusedError");
}

describe("Server.createLobby", () =>
{
    it("seats the caller as host and saves a waiting lobby", async () =>
    {
        const { server, lobbies } = setup("host-session");
        const lobby = await server.createLobby("Cian91", GameType.ORIGINAL);

        expect(lobby.getStatus()).toBe(LobbyStatus.WAITING);
        expect(lobby.seatOf("host-session")).toBe(1);
        expect(lobby.getPlayers()[0].getName()).toBe("Cian91");
        expect(lobbies.get(lobby.getCode())).toBe(lobby);
    });

    it("signs a first-time visitor in anonymously", async () =>
    {
        const { server, sessions } = setup(null);
        const lobby = await server.createLobby("Cian91", GameType.ORIGINAL);

        expect(sessions.signInAnonymously).toHaveBeenCalled();
        expect(lobby.seatOf("new-session")).toBe(1);
    });

    it("gives a blank name a random one", async () =>
    {
        const { server } = setup("host-session");
        const lobby = await server.createLobby("   ", GameType.ORIGINAL);
        expect(lobby.getPlayers()[0].getName()).toMatch(/^Player\d{3}$/);
    });

    it("refuses a name over 16 characters with INVALID_NAME", async () =>
    {
        const { server } = setup("host-session");
        expect(await refusal(server.createLobby("A".repeat(17), GameType.ORIGINAL))).toBe(JoinError.INVALID_NAME);
    });

    it("refuses an unknown game type", async () =>
    {
        const { server } = setup("host-session");
        await expect(server.createLobby("Cian91", 7)).rejects.toThrow("Unknown game type");
    });

    it("picks another code when the first one is taken", async () =>
    {
        const { server, lobbies } = setup("host-session");
        hostedLobby(lobbies, "AAAAAA");
        const codes = vi.spyOn(Lobby, "generateCode").mockReturnValueOnce("AAAAAA").mockReturnValueOnce("BBBBBB");

        const lobby = await server.createLobby("Cian91", GameType.ORIGINAL);

        expect(lobby.getCode()).toBe("BBBBBB");
        codes.mockRestore();
    });

    it("refuses when the rate limit is hit", async () =>
    {
        const { server } = setup("host-session", { allow: false });
        await expect(server.createLobby("Cian91", GameType.ORIGINAL)).rejects.toBeInstanceOf(RateLimitedError);
    });
});

describe("Server.joinLobby", () =>
{
    it("seats the guest, fills the lobby and starts placement", async () =>
    {
        const { server, lobbies } = setup("guest-session");
        hostedLobby(lobbies);

        const { lobby, player } = await server.joinLobby("4F7K2M", "Aoife");

        expect(player.getName()).toBe("Aoife");
        expect(lobby.seatOf("guest-session")).toBe(2);
        expect(lobby.getStatus()).toBe(LobbyStatus.IN_PROGRESS);
        expect(lobby.getGame().getState()).toBe(GameState.PLACEMENT);
    });

    it("accepts a lower-case code typed by hand", async () =>
    {
        const { server, lobbies } = setup("guest-session");
        hostedLobby(lobbies);
        const { lobby } = await server.joinLobby(" 4f7k2m ", "Aoife");
        expect(lobby.getCode()).toBe("4F7K2M");
    });

    it("refuses an unknown or malformed code with CODE_NOT_FOUND", async () =>
    {
        const { server } = setup("guest-session");
        expect(await refusal(server.joinLobby("ZZZZZZ", "Aoife"))).toBe(JoinError.CODE_NOT_FOUND);
        expect(await refusal(server.joinLobby("not a code", "Aoife"))).toBe(JoinError.CODE_NOT_FOUND);
    });

    it("refuses an abandoned lobby with CODE_NOT_FOUND", async () =>
    {
        const { server, lobbies } = setup("guest-session");
        hostedLobby(lobbies).abandon();
        expect(await refusal(server.joinLobby("4F7K2M", "Aoife"))).toBe(JoinError.CODE_NOT_FOUND);
    });

    it("refuses a third player with LOBBY_FULL", async () =>
    {
        const { server, lobbies } = setup("third-session");
        hostedLobby(lobbies).join("Aoife", "guest-session");
        expect(await refusal(server.joinLobby("4F7K2M", "Late"))).toBe(JoinError.LOBBY_FULL);
    });

    it("refuses a finished game with GAME_ALREADY_FINISHED", async () =>
    {
        const { server, lobbies } = setup("third-session");
        const finished = Lobby.restore("4F7K2M", GameType.ORIGINAL, LobbyStatus.FINISHED, new Date(), []);
        lobbies.set("4F7K2M", finished);
        expect(await refusal(server.joinLobby("4F7K2M", "Late"))).toBe(JoinError.GAME_ALREADY_FINISHED);
    });

    it("refuses a name over 16 characters with INVALID_NAME", async () =>
    {
        const { server, lobbies } = setup("guest-session");
        hostedLobby(lobbies);
        expect(await refusal(server.joinLobby("4F7K2M", "A".repeat(17)))).toBe(JoinError.INVALID_NAME);
    });

    it("gives the host their own seat back when they open their own link", async () =>
    {
        const { server, lobbies, repo } = setup("host-session");
        hostedLobby(lobbies);

        const { lobby, player } = await server.joinLobby("4F7K2M", "");

        expect(lobby.seatOf(player.getSessionId())).toBe(1);
        expect(lobby.getPlayers()).toHaveLength(1);
        expect(repo.saveLobby).not.toHaveBeenCalled();
    });
});

describe("Server.restoreSeat", () =>
{
    it("returns the caller's lobby and seat after a refresh", async () =>
    {
        const { server, lobbies } = setup("guest-session");
        hostedLobby(lobbies).join("Aoife", "guest-session");

        const restored = await server.restoreSeat();

        expect(restored?.lobby.getCode()).toBe("4F7K2M");
        expect(restored?.player.getName()).toBe("Aoife");
    });

    it("refuses a sessionId that doesn't match the caller's cookie", async () =>
    {
        const { server, lobbies } = setup("guest-session");
        hostedLobby(lobbies).join("Aoife", "guest-session");
        expect(await server.restoreSeat("host-session")).toBeNull();
    });

    it("returns null for a caller with no session", async () =>
    {
        const { server, lobbies } = setup(null);
        hostedLobby(lobbies);
        expect(await server.restoreSeat()).toBeNull();
    });

    it("returns null when the caller isn't seated in any active game", async () =>
    {
        const { server, lobbies } = setup("stranger");
        hostedLobby(lobbies);
        expect(await server.restoreSeat()).toBeNull();
    });
});
