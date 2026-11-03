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
import { EndReason, GameState, GameType, JoinError, LobbyStatus, RematchStatus, ShotResult } from "../../lib/enums";

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
    const notifier = { sendPrivate: vi.fn().mockResolvedValue(undefined) };
    const as = (who: string | null) => new Server({
        currentSessionId: vi.fn().mockResolvedValue(who),
        signInAnonymously: vi.fn().mockResolvedValue(who)
    } as unknown as SessionManager, repo, limiter, notifier);

    const lobby = await as("host").createLobby("Cian", GameType.ORIGINAL);
    const code = lobby.getCode();
    await as("guest").joinLobby(code, "Aoife");
    return { db, as, code, notifier };
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
        expect(winnerView.yourTurn).toBe(false);
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
        await as(second).claimTimeout(code);     // only the turn timer can be claimed now
        const view = await as(first).getMyState(code);
        expect(view.gameState).toBe(GameState.IN_PROGRESS);
        expect(view.endReason).toBeNull();
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

describe("Server turn timer", () =>
{
    afterEach(() => vi.useRealTimers());

    async function timedBattle()
    {
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(new Date("2026-11-03T12:00:00Z"));
        return startedBattle();                    // Original: 15 s a turn
    }

    it("fires a random shot for the player whose turn ran out", async () =>
    {
        const { as, code, first, second } = await timedBattle();
        vi.setSystemTime(new Date("2026-11-03T12:00:14Z"));
        expect(await as(second).claimTimeout(code)).toBe(false);

        vi.setSystemTime(new Date("2026-11-03T12:00:16Z"));
        expect(await as(second).claimTimeout(code)).toBe(true);
        expect((await as(first).getMyState(code)).yourShots).toHaveLength(1);
    });

    it("doesn't run while the player to move is disconnected", async () =>
    {
        const { as, code, first, second } = await timedBattle();
        await as(second).reportDisconnect(code);

        vi.setSystemTime(new Date("2026-11-03T12:00:40Z"));
        expect(await as(second).claimTimeout(code)).toBe(false);
        expect((await as(first).getMyState(code)).yourShots).toHaveLength(0);
    });

    it("fires the expired turn's random shot before anyone else's shot", async () =>
    {
        const { as, code, first, second } = await timedBattle();
        vi.setSystemTime(new Date("2026-11-03T12:00:16Z"));

        // a miss passes the turn, so this shot lands; a hit keeps it, so this shot is refused
        await as(second).fireShot(code, { row: 9, col: 9 }).catch(e => expect(e).toBeInstanceOf(MoveRefusedError));
        expect((await as(first).getMyState(code)).yourShots).toHaveLength(1);
    });

    it("has nothing to claim while the lobby is still waiting", async () =>
    {
        const { as } = await battle();
        const alone = await as("solo").createLobby("Solo", GameType.ORIGINAL);
        expect(await as("solo").claimTimeout(alone.getCode())).toBe(false);
    });
});

describe("Server waiting lobby", () =>
{
    afterEach(() => vi.useRealTimers());

    it("closes the lobby once the host has been gone over 30 seconds", async () =>
    {
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(new Date("2026-11-03T12:00:00Z"));
        const { server, lobbies } = setup("guest-session");
        const lobby = hostedLobby(lobbies);

        vi.setSystemTime(new Date("2026-11-03T12:00:31Z"));
        expect(await refusal(server.joinLobby("4F7K2M", "Aoife"))).toBe(JoinError.CODE_NOT_FOUND);
        expect(lobby.getStatus()).toBe(LobbyStatus.ABANDONED);
    });

    it("lets a guest in while the host is still checking in", async () =>
    {
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(new Date("2026-11-03T12:00:00Z"));
        const { server, lobbies } = setup("guest-session");
        hostedLobby(lobbies);

        vi.setSystemTime(new Date("2026-11-03T12:00:25Z"));
        const { player } = await server.joinLobby("4F7K2M", "Aoife");
        expect(player.getName()).toBe("Aoife");
    });

    it("keeps the lobby open on the host's heartbeat, and stops once a guest joins", async () =>
    {
        const { as } = await battle();
        const alone = await as("solo").createLobby("Solo", GameType.ORIGINAL);
        expect(await as("solo").keepLobbyOpen(alone.getCode())).toBe(true);

        await as("friend").joinLobby(alone.getCode(), "Friend");
        expect(await as("solo").keepLobbyOpen(alone.getCode())).toBe(false);
    });

    it("refuses a heartbeat from someone who isn't seated", async () =>
    {
        const { as, code } = await battle();
        await expect(as("stranger").keepLobbyOpen(code)).rejects.toBeInstanceOf(NotSeatedError);
    });
});

describe("Server.requestRematch", () =>
{
    async function finished()
    {
        const setup = await startedBattle();
        await setup.as(setup.first).forfeit(setup.code);
        return setup;
    }

    it("records the offer so the other player sees who asked", async () =>
    {
        const { as, code, first, second } = await finished();
        const r = await as(second).requestRematch(code, true);
        expect(r.getStatus()).toBe(RematchStatus.REQUESTED);

        const theirView = await as(first).getMyState(code);
        expect(theirView.rematch).toEqual({ by: theirView.seat === 1 ? 2 : 1, status: RematchStatus.REQUESTED });
    });

    it("resets the same lobby to placement once both agree", async () =>
    {
        const { as, code, first, second } = await finished();
        await as(second).requestRematch(code, true);
        const r = await as(first).requestRematch(code, true);
        expect(r.isMutual()).toBe(true);

        const view = await as(first).getMyState(code);
        expect(view.code).toBe(code);
        expect(view.gameState).toBe(GameState.PLACEMENT);
        expect(view.lobbyStatus).toBe(LobbyStatus.IN_PROGRESS);
        expect(view.yourShots).toEqual([]);
        expect(view.yourBoard.ships).toEqual([]);
        expect(view.winner).toBeNull();
        expect(view.rematch).toBeNull();
        expect(view.you.ready).toBe(false);
    });

    it("lets the new game be played from the start", async () =>
    {
        const { as, code, first, second } = await finished();
        await as(second).requestRematch(code, true);
        await as(first).requestRematch(code, true);
        await as("host").placeShips(code, layout());
        await as("guest").placeShips(code, layout());
        expect((await as("host").getMyState(code)).gameState).toBe(GameState.IN_PROGRESS);
    });

    it("doesn't count asking twice as agreeing", async () =>
    {
        const { as, code, second } = await finished();
        await as(second).requestRematch(code, true);
        const again = await as(second).requestRematch(code, true);
        expect(again.getStatus()).toBe(RematchStatus.REQUESTED);
        expect((await as(second).getMyState(code)).gameState).toBe(GameState.FINISHED);
    });

    it("closes the lobby on a decline, so the code stops working", async () =>
    {
        const { as, code, first, second } = await finished();
        await as(second).requestRematch(code, true);
        const r = await as(first).requestRematch(code, false);
        expect(r.getStatus()).toBe(RematchStatus.DECLINED);

        const view = await as(second).getMyState(code);
        expect(view.lobbyStatus).toBe(LobbyStatus.ABANDONED);
        expect(view.rematch?.status).toBe(RematchStatus.DECLINED);
        expect((await as(second).requestRematch(code, true)).getStatus()).toBe(RematchStatus.DECLINED);
    });

    it("closes the lobby when a player leaves without anyone asking", async () =>
    {
        const { as, code, first } = await finished();
        await as(first).requestRematch(code, false);
        expect((await as(first).getMyState(code)).lobbyStatus).toBe(LobbyStatus.ABANDONED);
    });

    it("refuses before the game is over", async () =>
    {
        const { as, code, first } = await startedBattle();
        await expect(as(first).requestRematch(code, true)).rejects.toBeInstanceOf(MoveRefusedError);
    });

    it("refuses an answer that isn't true or false", async () =>
    {
        const { as, code, first } = await finished();
        await expect(as(first).requestRematch(code, "yes")).rejects.toBeInstanceOf(InvalidRequestError);
    });
});

// ---------------------------------------------------------------- abilities

/** A started battle where `first` (to move) holds `held` and maybe has an offer pending, set straight in the fake database. */
async function withAbility(held: string, offered: string | null = null)
{
    const setup = await startedBattle();
    const seat = setup.first === "host" ? 1 : 2;
    Object.assign(setup.db.games.get(setup.code)!, { [`ability_p${seat}`]: held, [`offered_ability_p${seat}`]: offered });
    return { ...setup, seat };
}

/** What a private message to this session carried, by kind. */
function sentTo(notifier: { sendPrivate: ReturnType<typeof vi.fn> }, sessionId: string, kind: string)
{
    return notifier.sendPrivate.mock.calls
        .filter(([p, payload]) => p.getSessionId() === sessionId && payload.kind === kind)
        .map(([, payload]) => payload);
}

describe("Server.useAbility", () =>
{
    it("scans a 3x3 area for the caller only and uses up the turn's shot", async () =>
    {
        const { as, code, first, second, notifier } = await withAbility("radar_sweep");
        await as(first).useAbility(code, { name: "Radar Sweep" }, { row: 0, col: 0 });

        const mine = await as(first).getMyState(code);
        expect(mine.heldAbility).toBeNull();
        expect(mine.yourTurn).toBe(false);
        expect(mine.revealedSquares).toHaveLength(9);                  // the known fleet fills that corner

        const theirs = await as(second).getMyState(code);
        expect(theirs.revealedSquares).toEqual([]);
        expect(JSON.stringify(theirs)).not.toContain("Radar Sweep");
        expect(sentTo(notifier, first, "scanResult")[0].cells).toHaveLength(9);
        expect(sentTo(notifier, second, "abilityUsed")[0]).toMatchObject({ by: first === "host" ? "Cian" : "Aoife" });
        expect(sentTo(notifier, second, "scanResult")).toEqual([]);
    });

    it("scans a row with Line Scan", async () =>
    {
        const { as, code, first } = await withAbility("line_scan");
        await as(first).useAbility(code, { name: "Line Scan", line: "row" }, { row: 4, col: 0 });
        expect((await as(first).getMyState(code)).revealedSquares).toEqual([{ row: 4, col: 0 }, { row: 4, col: 1 }]);
    });

    it("keeps a revealed square highlighted until it's shot", async () =>
    {
        const { as, code, first, second } = await withAbility("radar_sweep");
        await as(first).useAbility(code, { name: "Radar Sweep" }, { row: 0, col: 0 });
        await as(second).fireShot(code, { row: 9, col: 9 });           // a miss, back to first
        await as(first).fireShot(code, { row: 0, col: 0 });
        expect((await as(first).getMyState(code)).revealedSquares).toHaveLength(8);
    });

    it("arms Double Shot without a target and keeps the turn", async () =>
    {
        const { as, code, first } = await withAbility("double_shot");
        await as(first).useAbility(code, { name: "Double Shot" });
        const view = await as(first).getMyState(code);
        expect(view.doubleShotActive).toBe(true);
        expect(view.yourTurn).toBe(true);
    });

    it("reroutes your own undamaged ship and clears the opponent's scan of it", async () =>
    {
        const { as, code, first, second, db } = await startedBattle();
        const firstSeat = first === "host" ? 1 : 2;
        Object.assign(db.games.get(code)!, { [`ability_p${3 - firstSeat}`]: "line_scan" });
        await as(first).fireShot(code, { row: 9, col: 9 });            // a miss, second to move
        await as(second).useAbility(code, { name: "Line Scan", line: "row" }, { row: 4, col: 0 });
        expect((await as(second).getMyState(code)).revealedSquares).toHaveLength(2);

        Object.assign(db.games.get(code)!, { [`ability_p${firstSeat}`]: "reroute" });
        await as(first).useAbility(code, { name: "Reroute", ship: "Destroyer", orientation: "horizontal" }, { row: 9, col: 0 });

        const moved = (await as(first).getMyState(code)).yourBoard.ships.find(s => s.name === "Destroyer");
        expect(moved).toMatchObject({ row: 9, col: 0 });
        expect((await as(second).getMyState(code)).revealedSquares).toEqual([]);
    });

    it("uses the held ability before an offer is answered, and that counts as keeping it", async () =>
    {
        const { as, code, first } = await withAbility("radar_sweep", "line_scan");
        await as(first).useAbility(code, { name: "Radar Sweep" }, { row: 0, col: 0 });
        const view = await as(first).getMyState(code);
        expect(view.heldAbility).toBeNull();
        expect(view.offeredAbility).toBeNull();
    });

    it("refuses an ability the caller doesn't hold", async () =>
    {
        const { as, code, first } = await withAbility("double_shot");
        await expect(as(first).useAbility(code, { name: "Radar Sweep" }, { row: 0, col: 0 })).rejects.toBeInstanceOf(MoveRefusedError);
    });

    it("refuses when it isn't the caller's turn, and the ability stays held", async () =>
    {
        const { as, code, second, db } = await startedBattle();
        const seat = second === "host" ? 1 : 2;
        Object.assign(db.games.get(code)!, { [`ability_p${seat}`]: "radar_sweep" });
        await expect(as(second).useAbility(code, { name: "Radar Sweep" }, { row: 0, col: 0 })).rejects.toBeInstanceOf(MoveRefusedError);
        expect((await as(second).getMyState(code)).heldAbility).toBe("Radar Sweep");
    });

    it("refuses a target off the board without using the ability up", async () =>
    {
        const { as, code, first } = await withAbility("radar_sweep");
        await expect(as(first).useAbility(code, { name: "Radar Sweep" }, { row: 8, col: 8 })).rejects.toBeInstanceOf(MoveRefusedError);
        expect((await as(first).getMyState(code)).heldAbility).toBe("Radar Sweep");
    });

    it("refuses an unknown ability or missing details", async () =>
    {
        const { as, code, first } = await withAbility("line_scan");
        await expect(as(first).useAbility(code, { name: "Nuke" }, { row: 0, col: 0 })).rejects.toBeInstanceOf(InvalidRequestError);
        await expect(as(first).useAbility(code, { name: "Line Scan" }, { row: 0, col: 0 })).rejects.toBeInstanceOf(InvalidRequestError);
    });
});

describe("Server.chooseAbility", () =>
{
    it("swaps in the new draw when the player doesn't keep", async () =>
    {
        const { as, code, first } = await withAbility("radar_sweep", "double_shot");
        await as(first).chooseAbility(code, false);
        const view = await as(first).getMyState(code);
        expect(view.heldAbility).toBe("Double Shot");
        expect(view.offeredAbility).toBeNull();
    });

    it("keeps the held one when the player keeps", async () =>
    {
        const { as, code, first } = await withAbility("radar_sweep", "double_shot");
        await as(first).chooseAbility(code, true);
        const view = await as(first).getMyState(code);
        expect(view.heldAbility).toBe("Radar Sweep");
        expect(view.offeredAbility).toBeNull();
    });

    it("does nothing when there's no offer to answer", async () =>
    {
        const { as, code, first } = await withAbility("radar_sweep");
        await as(first).chooseAbility(code, false);
        expect((await as(first).getMyState(code)).heldAbility).toBe("Radar Sweep");
    });

    it("refuses an answer that isn't true or false", async () =>
    {
        const { as, code, first } = await withAbility("radar_sweep", "double_shot");
        await expect(as(first).chooseAbility(code, "no")).rejects.toBeInstanceOf(InvalidRequestError);
    });
});

describe("Server ability offers and scans", () =>
{
    it("sends a keep-or-replace offer to a player who already holds one when their ship sinks", async () =>
    {
        const { as, code, first, second, db, notifier } = await startedBattle();
        const seat = second === "host" ? 1 : 2;
        Object.assign(db.games.get(code)!, { [`ability_p${seat}`]: "radar_sweep" });
        await as(first).fireShot(code, { row: 4, col: 0 });
        await as(first).fireShot(code, { row: 4, col: 1 });           // sinks the Destroyer

        const [offer] = sentTo(notifier, second, "abilityOffer");
        expect(offer.current.getName()).toBe("Radar Sweep");
        expect((await as(second).getMyState(code)).offeredAbility).toBe(offer.drawn.getName());
    });

    it("clears every scan when a rematch starts", async () =>
    {
        const { as, code, first, second, db } = await withAbility("radar_sweep");
        await as(first).useAbility(code, { name: "Radar Sweep" }, { row: 0, col: 0 });
        await as(second).forfeit(code);
        await as(first).requestRematch(code, true);
        await as(second).requestRematch(code, true);
        expect(db.secrets.get(code)!.scan_log).toEqual({ p1: [], p2: [] });
    });

    it("keeps going when a private message can't be sent", async () =>
    {
        const { as, code, first, notifier } = await withAbility("radar_sweep");
        notifier.sendPrivate.mockRejectedValue(new Error("Realtime down"));
        const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
        await expect(as(first).useAbility(code, { name: "Radar Sweep" }, { row: 0, col: 0 })).resolves.toBeUndefined();
        expect((await as(first).getMyState(code)).revealedSquares).toHaveLength(9);
        quiet.mockRestore();
    });
});
