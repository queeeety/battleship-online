import { describe, it, expect } from "vitest";
import { screenFor } from "../../components/screens/screenFor";
import type { PlayerView } from "../../lib/controllers/Server";
import { GameState, GameType, LobbyStatus } from "../../lib/enums";

function view(lobbyStatus: LobbyStatus, gameState: GameState | null): PlayerView
{
    return {
        code: "K7Q2XM", gameType: GameType.ORIGINAL, lobbyStatus, gameState, seat: 1,
        you: { name: "Tim", ready: false, connected: true, disconnectedAt: null }, opponent: null,
        yourTurn: false, turnStartedAt: null, doubleShotActive: false,
        yourBoard: { ships: [], shots: [] }, yourShots: [], opponentShots: [],
        heldAbility: null, offeredAbility: null, winner: null, endReason: null, opponentBoard: null, opponentSunkShips: [],
        revealedSquares: [], rematch: null, result: null
    };
}

const seated = { notSeated: false, wasSeated: true };

describe("screenFor", () =>
{
    it("waits for the first view", () =>
    {
        expect(screenFor({ view: null, notSeated: false, wasSeated: false })).toBe("loading");
    });

    it("offers to join when a visitor has no seat", () =>
    {
        expect(screenFor({ view: null, notSeated: true, wasSeated: false })).toBe("join");
    });

    it("says the game is gone when a seated player loses the seat", () =>
    {
        expect(screenFor({ view: view(LobbyStatus.IN_PROGRESS, GameState.IN_PROGRESS), notSeated: true, wasSeated: true })).toBe("gone");
    });

    it("shows the lobby while the host waits", () =>
    {
        expect(screenFor({ view: view(LobbyStatus.WAITING, null), ...seated })).toBe("lobby");
    });

    it("says the lobby closed when it was abandoned before anyone joined", () =>
    {
        expect(screenFor({ view: view(LobbyStatus.ABANDONED, null), ...seated })).toBe("closed");
    });

    it("follows the game through placement, battle and result", () =>
    {
        expect(screenFor({ view: view(LobbyStatus.IN_PROGRESS, GameState.PLACEMENT), ...seated })).toBe("placement");
        expect(screenFor({ view: view(LobbyStatus.IN_PROGRESS, GameState.IN_PROGRESS), ...seated })).toBe("battle");
        expect(screenFor({ view: view(LobbyStatus.FINISHED, GameState.FINISHED), ...seated })).toBe("result");
    });

    it("stays on the result after a declined rematch closes the lobby", () =>
    {
        expect(screenFor({ view: view(LobbyStatus.ABANDONED, GameState.FINISHED), ...seated })).toBe("result");
    });
});
