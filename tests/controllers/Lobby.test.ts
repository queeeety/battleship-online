import { describe, it, expect } from "vitest";
import { Lobby } from "../../lib/controllers/Lobby";
import { GameState, GameType, LobbyStatus } from "../../lib/enums";
import { LOBBY_CODE_CHARS, LOBBY_CODE_LENGTH } from "../../lib/config";

describe("Lobby.generateCode", () =>
{
    it("makes codes of the right length from the allowed characters only", () =>
    {
        for (let i = 0; i < 200; i++)
        {
            const code = Lobby.generateCode();
            expect(code).toHaveLength(LOBBY_CODE_LENGTH);
            for (const ch of code) expect(LOBBY_CODE_CHARS).toContain(ch);
        }
    });

    it("never uses the ambiguous characters 0, O, 1, I or L", () =>
    {
        const all = Array.from({ length: 200 }, () => Lobby.generateCode()).join("");
        expect(all).not.toMatch(/[0O1IL]/);
    });

    it("gives a new lobby a generated code unless one is passed in", () =>
    {
        expect(new Lobby(GameType.ORIGINAL).getCode()).toHaveLength(LOBBY_CODE_LENGTH);
        expect(new Lobby(GameType.ORIGINAL, "4F7K2M").getCode()).toBe("4F7K2M");
    });
});

describe("Lobby seating", () =>
{
    it("starts waiting, empty and joinable", () =>
    {
        const lobby = new Lobby(GameType.ORIGINAL);
        expect(lobby.getStatus()).toBe(LobbyStatus.WAITING);
        expect(lobby.isFull()).toBe(false);
        expect(lobby.isJoinable()).toBe(true);
    });

    it("seats the host in seat 1 and keeps waiting", () =>
    {
        const lobby = new Lobby(GameType.ORIGINAL);
        const host = lobby.join("Cian91", "host-session");
        expect(host.getName()).toBe("Cian91");
        expect(host.getSessionId()).toBe("host-session");
        expect(lobby.seatOf("host-session")).toBe(1);
        expect(lobby.getStatus()).toBe(LobbyStatus.WAITING);
    });

    it("seats the guest in seat 2, fills the lobby and starts placement", () =>
    {
        const lobby = new Lobby(GameType.ORIGINAL);
        lobby.join("Cian91", "host-session");
        lobby.join("Player482", "guest-session");
        expect(lobby.seatOf("guest-session")).toBe(2);
        expect(lobby.isFull()).toBe(true);
        expect(lobby.isJoinable()).toBe(false);
        expect(lobby.getStatus()).toBe(LobbyStatus.IN_PROGRESS);
        expect(lobby.getGame().getState()).toBe(GameState.PLACEMENT);
        expect(lobby.getGame().getPlayers()).toHaveLength(2);
    });

    it("refuses a third player", () =>
    {
        const lobby = new Lobby(GameType.ORIGINAL);
        lobby.join("A", "a");
        lobby.join("B", "b");
        expect(() => lobby.join("C", "c")).toThrow();
    });

    it("refuses the same session taking both seats", () =>
    {
        const lobby = new Lobby(GameType.ORIGINAL);
        lobby.join("Cian91", "host-session");
        expect(() => lobby.join("Cian again", "host-session")).toThrow();
    });

    it("gives null for a session with no seat", () =>
    {
        const lobby = new Lobby(GameType.ORIGINAL);
        lobby.join("Cian91", "host-session");
        expect(lobby.seatOf("stranger")).toBeNull();
    });

    it("can't be joined once abandoned", () =>
    {
        const lobby = new Lobby(GameType.ORIGINAL);
        lobby.join("Cian91", "host-session");
        lobby.abandon();
        expect(lobby.getStatus()).toBe(LobbyStatus.ABANDONED);
        expect(lobby.isJoinable()).toBe(false);
        expect(() => lobby.join("Late", "late-session")).toThrow();
    });
});

describe("Lobby.shareLink", () =>
{
    it("points at the /game/[code] route", () =>
    {
        expect(new Lobby(GameType.ORIGINAL, "4F7K2M").shareLink()).toBe("/game/4F7K2M");
    });
});

describe("Lobby.reset", () =>
{
    it("keeps the code and both players but starts a fresh game in placement", () =>
    {
        const lobby = new Lobby(GameType.ORIGINAL, "4F7K2M");
        lobby.join("A", "a");
        lobby.join("B", "b");
        const oldGame = lobby.getGame();

        lobby.reset();

        expect(lobby.getCode()).toBe("4F7K2M");
        expect(lobby.getGame()).not.toBe(oldGame);
        expect(lobby.getGame().getState()).toBe(GameState.PLACEMENT);
        expect(lobby.getGame().getPlayers()).toEqual(lobby.getPlayers());
        expect(lobby.getStatus()).toBe(LobbyStatus.IN_PROGRESS);
        for (const p of lobby.getPlayers())
        {
            expect(p.getIsReady()).toBe(false);
            expect(p.getBoard().getShips()).toHaveLength(0);
        }
    });
});

describe("Lobby.restore", () =>
{
    it("rebuilds a lobby with its status, players and game", () =>
    {
        const original = new Lobby(GameType.QUICK_FIRE, "4F7K2M");
        const host = original.join("A", "a");
        const guest = original.join("B", "b");
        const created = new Date("2026-11-02T12:00:00Z");

        const restored = Lobby.restore("4F7K2M", GameType.QUICK_FIRE, LobbyStatus.IN_PROGRESS, created, [host, guest]);

        expect(restored.getCode()).toBe("4F7K2M");
        expect(restored.getGameType()).toBe(GameType.QUICK_FIRE);
        expect(restored.getStatus()).toBe(LobbyStatus.IN_PROGRESS);
        expect(restored.getCreatedAt()).toEqual(created);
        expect(restored.seatOf("a")).toBe(1);
        expect(restored.seatOf("b")).toBe(2);
        expect(restored.getGame().getPlayers()).toHaveLength(2);
    });
});
