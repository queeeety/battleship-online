import { describe, it, expect, vi, afterEach } from "vitest";
import { Server, JoinRefusedError, RateLimitedError, NotSeatedError } from "../../lib/controllers/Server";
import { Lobby } from "../../lib/controllers/Lobby";
import type { SessionManager } from "../../lib/server/SessionManager";
import { GameRepository, MoveRefusedError } from "../../lib/server/GameRepository";
import { InvalidRequestError } from "../../lib/server/RequestValidator";
import { Board } from "../../lib/entities/board";
import { placeKnownFleet } from "../helpers";
import { fakeSupabase } from "../server/fakeSupabase";
import type { RateLimiter } from "../../lib/server/RateLimiter";
import { EndReason, GameState, GameType, JoinError, LobbyStatus, ShotResult } from "../../lib/enums";

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

// ---------------------------------------------------------------- battle (real GameRepository, fake database)

/**
 * A host and a guest seated in one lobby, with the real GameRepository on a fake database.
 * `as(who)` returns a Server acting as that player, like a request carrying their cookie.
 */
async function battle()
{
    const db = fakeSupabase();
    const repo = new GameRepository(db.client);
    const limiter = { allow: vi.fn().mockResolvedValue(true) } as unknown as RateLimiter;
    const as = (who: string | null) => new Server({
        currentSessionId: vi.fn().mockResolvedValue(who),
        signInAnonymously: vi.fn().mockResolvedValue(who)
    } as unknown as SessionManager, repo, limiter);

    const lobby = await as("host").createLobby("Cian", GameType.ORIGINAL);
    const code = lobby.getCode();
    await as("guest").joinLobby(code, "Aoife");
    return { db, as, code };
}

/** A legal layout: the shared known fleet, or a random one. */
function layout(random = false)
{
    const board = random ? new Board() : placeKnownFleet();
    if (random) board.placeFleetRandomly();
    return { ships: board.toSnapshot().ships };
}

/** Both fleets placed; returns who moves first and who waits. */
async function startedBattle()
{
    const setup = await battle();
    await setup.as("host").placeShips(setup.code, layout());
    await setup.as("guest").placeShips(setup.code, layout());
    const hostFirst = (await setup.as("host").getMyState(setup.code)).yourTurn;
    return { ...setup, first: hostFirst ? "host" : "guest", second: hostFirst ? "guest" : "host" };
}

describe("Server.placeShips", () =>
{
    it("marks the caller ready and waits for the other player", async () =>
    {
        const { as, code } = await battle();
        await as("host").placeShips(code, layout());

        const view = await as("host").getMyState(code);
        expect(view.you.ready).toBe(true);
        expect(view.opponent?.ready).toBe(false);
        expect(view.gameState).toBe(GameState.PLACEMENT);
        expect(view.yourBoard.ships).toHaveLength(5);
    });

    it("starts the battle once both fleets are placed, with exactly one player to move", async () =>
    {
        const { as, code } = await startedBattle();
        const host = await as("host").getMyState(code);
        const guest = await as("guest").getMyState(code);
        expect(host.gameState).toBe(GameState.IN_PROGRESS);
        expect(host.yourTurn).not.toBe(guest.yourTurn);
    });

    it("refuses an illegal layout", async () =>
    {
        const { as, code } = await battle();
        const bad = layout();
        bad.ships.pop();
        await expect(as("host").placeShips(code, bad)).rejects.toBeInstanceOf(InvalidRequestError);
    });

    it("refuses before a guest has joined", async () =>
    {
        const { as } = await battle();
        const alone = await as("solo").createLobby("Solo", GameType.ORIGINAL);
        await expect(as("solo").placeShips(alone.getCode(), layout())).rejects.toBeInstanceOf(MoveRefusedError);
    });

    it("refuses someone who isn't seated", async () =>
    {
        const { as, code } = await battle();
        await expect(as("stranger").placeShips(code, layout())).rejects.toBeInstanceOf(NotSeatedError);
        await expect(as(null).placeShips(code, layout())).rejects.toBeInstanceOf(NotSeatedError);
    });
});

describe("Server.fireShot", () =>
{
    it("resolves a hit for the player to move, who keeps the turn", async () =>
    {
        const { as, code, first } = await startedBattle();
        const shot = await as(first).fireShot(code, { row: 0, col: 0 });
        expect(shot.getResult()).toBe(ShotResult.HIT);
        expect((await as(first).getMyState(code)).yourTurn).toBe(true);
    });

    it("passes the turn on a miss", async () =>
    {
        const { as, code, first, second } = await startedBattle();
        await as(first).fireShot(code, { row: 9, col: 9 });
        expect((await as(second).getMyState(code)).yourTurn).toBe(true);
    });

    it("refuses the player who isn't on turn", async () =>
    {
        const { as, code, second } = await startedBattle();
        await expect(as(second).fireShot(code, { row: 0, col: 0 })).rejects.toBeInstanceOf(MoveRefusedError);
    });

    it("refuses a square already fired at", async () =>
    {
        const { as, code, first } = await startedBattle();
        await as(first).fireShot(code, { row: 0, col: 0 });
        await expect(as(first).fireShot(code, { row: 0, col: 0 })).rejects.toBeInstanceOf(MoveRefusedError);
    });

    it("refuses a square off the board", async () =>
    {
        const { as, code, first } = await startedBattle();
        await expect(as(first).fireShot(code, { row: 10, col: 0 })).rejects.toBeInstanceOf(InvalidRequestError);
    });

    it("lands only one shot when the same click arrives twice at once", async () =>
    {
        const { as, code, first } = await startedBattle();
        const results = await Promise.allSettled([
            as(first).fireShot(code, { row: 9, col: 9 }),
            as(first).fireShot(code, { row: 9, col: 9 })
        ]);
        expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
        expect((await as(first).getMyState(code)).yourShots).toHaveLength(1);
    });
});

describe("Server.getMyState", () =>
{
    it("shows your own fleet but never the opponent's while the game is running", async () =>
    {
        const { as, code } = await battle();
        const hostLayout = layout(true);
        await as("host").placeShips(code, hostLayout);
        await as("guest").placeShips(code, layout(true));

        const view = await as("host").getMyState(code);
        expect(view.yourBoard.ships).toEqual(hostLayout.ships);
        expect(view.opponentBoard).toBeNull();
        expect(view.result).toBeNull();
    });

    it("shows the opponent's shots at you and yours at them", async () =>
    {
        const { as, code, first, second } = await startedBattle();
        await as(first).fireShot(code, { row: 9, col: 9 });

        expect((await as(first).getMyState(code)).yourShots).toEqual([{ row: 9, col: 9, result: ShotResult.MISS, sunkShipName: null }]);
        expect((await as(second).getMyState(code)).opponentShots).toHaveLength(1);
    });

    it("works while the lobby is still waiting for a guest", async () =>
    {
        const { as } = await battle();
        const alone = await as("solo").createLobby("Solo", GameType.ORIGINAL);
        const view = await as("solo").getMyState(alone.getCode());
        expect(view.gameState).toBeNull();
        expect(view.opponent).toBeNull();
        expect(view.seat).toBe(1);
    });

    it("refuses someone who isn't seated", async () =>
    {
        const { as, code } = await battle();
        await expect(as("stranger").getMyState(code)).rejects.toBeInstanceOf(NotSeatedError);
    });
});

describe("Server.forfeit", () =>
{
    it("ends the game for the other player and reveals both fleets", async () =>
    {
        const { as, code, first, second } = await startedBattle();
        await as(first).forfeit(code);

        const winnerView = await as(second).getMyState(code);
        expect(winnerView.gameState).toBe(GameState.FINISHED);
        expect(winnerView.endReason).toBe(EndReason.OPPONENT_FORFEIT);
        expect(winnerView.result?.won).toBe(true);
        expect(winnerView.opponentBoard?.ships).toHaveLength(5);
        expect(winnerView.lobbyStatus).toBe(LobbyStatus.FINISHED);
    });

    it("does nothing the second time", async () =>
    {
        const { as, code, first } = await startedBattle();
        await as(first).forfeit(code);
        await expect(as(first).forfeit(code)).resolves.toBeUndefined();
    });
});

describe("Server disconnects", () =>
{
    const away = async () =>
    {
        const setup = await startedBattle();
        await setup.as(setup.second).reportDisconnect(setup.code);
        return setup;
    };

    afterEach(() => vi.useRealTimers());

    it("starts the opponent's 60-second clock when their presence drops", async () =>
    {
        const { as, code, second } = await away();
        const view = await as(second).getMyState(code);
        expect(view.opponent?.connected).toBe(false);
        expect(view.opponent?.disconnectedAt).not.toBeNull();
        expect(view.you.connected).toBe(true);
    });

    it("keeps the first disconnect time when reported again", async () =>
    {
        const { as, code, second, db } = await away();
        const seat = (await as(second).getMyState(code)).seat;
        const key = `disconnected_at_p${3 - seat}`;
        const firstTime = db.games.get(code)![key];
        await as(second).reportDisconnect(code);
        expect(db.games.get(code)![key]).toBe(firstTime);
    });

    it("clears the disconnect as soon as the player is back", async () =>
    {
        const { as, code, first, second } = await away();
        const back = await as(first).getMyState(code);
        expect(back.you.connected).toBe(true);
        expect(back.you.disconnectedAt).toBeNull();
        expect((await as(second).getMyState(code)).opponent?.connected).toBe(true);
    });

    it("pauses the turn timer while the player to move is away", async () =>
    {
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(new Date("2026-11-03T12:00:00Z"));
        const { as, code, first, second } = await away();
        const before = Date.parse((await as(second).getMyState(code)).turnStartedAt!);

        vi.setSystemTime(new Date("2026-11-03T12:00:20Z"));
        const back = await as(first).getMyState(code);
        expect(Date.parse(back.turnStartedAt!) - before).toBe(20_000);
    });

    it("does nothing while the lobby is waiting or once the game is over", async () =>
    {
        const { as, code, first, second, db } = await startedBattle();
        await as(first).forfeit(code);
        await as(second).reportDisconnect(code);
        expect(db.games.get(code)!.disconnected_at_p1).toBeNull();
        expect(db.games.get(code)!.disconnected_at_p2).toBeNull();

        const alone = await as("solo").createLobby("Solo", GameType.ORIGINAL);
        await expect(as("solo").reportDisconnect(alone.getCode())).resolves.toBeUndefined();
    });

    it("refuses reports past the rate limit", async () =>
    {
        const { server, lobbies } = setup("host-session", { allow: false });
        hostedLobby(lobbies);
        await expect(server.reportDisconnect("4F7K2M")).rejects.toBeInstanceOf(RateLimitedError);
    });
});

describe("Server.claimTimeout", () =>
{
    afterEach(() => vi.useRealTimers());

    it("awards the win once the opponent has been gone for 60 seconds", async () =>
    {
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(new Date("2026-11-03T12:00:00Z"));
        const { as, code, second } = await startedBattle();
        await as(second).reportDisconnect(code);

        vi.setSystemTime(new Date("2026-11-03T12:00:59Z"));
        expect(await as(second).claimTimeout(code)).toBe(false);
        expect((await as(second).getMyState(code)).gameState).toBe(GameState.IN_PROGRESS);

        vi.setSystemTime(new Date("2026-11-03T12:01:01Z"));
        expect(await as(second).claimTimeout(code)).toBe(true);
        const view = await as(second).getMyState(code);
        expect(view.gameState).toBe(GameState.FINISHED);
        expect(view.endReason).toBe(EndReason.OPPONENT_DISCONNECTED);
        expect(view.result?.won).toBe(true);
    });

    it("refuses the claim if the player came back in time", async () =>
    {
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(new Date("2026-11-03T12:00:00Z"));
        const { as, code, first, second } = await startedBattle();
        await as(second).reportDisconnect(code);
        await as(first).getMyState(code);

        vi.setSystemTime(new Date("2026-11-03T12:01:30Z"));
        expect(await as(second).claimTimeout(code)).toBe(false);
        expect((await as(first).getMyState(code)).gameState).toBe(GameState.IN_PROGRESS);
    });

    it("does nothing once the game is over", async () =>
    {
        const { as, code, first, second } = await startedBattle();
        await as(first).forfeit(code);
        expect(await as(second).claimTimeout(code)).toBe(false);
    });

    it("refuses someone who isn't seated", async () =>
    {
        const { as, code } = await startedBattle();
        await expect(as("stranger").claimTimeout(code)).rejects.toBeInstanceOf(NotSeatedError);
    });
});
