import type { PlayerView } from "../../lib/controllers/Server";
import { GameState, GameType, LobbyStatus } from "../../lib/enums";

/** A battle in progress with nothing fired yet; override what a test needs. */
export function makeView(overrides: Partial<PlayerView> = {}): PlayerView
{
    return {
        code: "K7Q2XM", gameType: GameType.ORIGINAL, lobbyStatus: LobbyStatus.IN_PROGRESS, gameState: GameState.IN_PROGRESS,
        seat: 1,
        you: { name: "Tim", ready: true, connected: true, disconnectedAt: null },
        opponent: { name: "Teddy", ready: true, connected: true, disconnectedAt: null },
        yourTurn: true, turnStartedAt: "2026-11-04T12:00:00.000Z", doubleShotActive: false,
        yourBoard: {
            ships: [
                { name: "Carrier", row: 0, col: 0, orientation: "horizontal" },
                { name: "Battleship", row: 2, col: 0, orientation: "horizontal" },
                { name: "Cruiser", row: 4, col: 0, orientation: "horizontal" },
                { name: "Submarine", row: 6, col: 0, orientation: "horizontal" },
                { name: "Destroyer", row: 8, col: 0, orientation: "horizontal" }
            ],
            shots: []
        },
        yourShots: [], opponentShots: [],
        heldAbility: null, offeredAbility: null, winner: null, endReason: null, opponentBoard: null,
        revealedSquares: [], rematch: null, result: null,
        ...overrides
    };
}
