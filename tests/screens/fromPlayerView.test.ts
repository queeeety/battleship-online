import { describe, it, expect } from "vitest";
import {
    abilityLogEntry,
    finalEnemyBoardState,
    newLogEntries,
    ownBoardState,
    rematchState,
    resultSummary,
    sunkNotice,
    targetBoardState
} from "../../components/screens/fromPlayerView";
import { EndReason, RematchStatus, ShotResult } from "../../lib/enums";
import { makeView } from "./makeView";

const miss = (row: number, col: number) => ({ row, col, result: ShotResult.MISS, sunkShipName: null });
const hit = (row: number, col: number) => ({ row, col, result: ShotResult.HIT, sunkShipName: null });
const sunk = (row: number, col: number, name: string) => ({ row, col, result: ShotResult.SUNK, sunkShipName: name });

describe("ownBoardState", () =>
{
    it("draws your fleet with the opponent's shots on it", () =>
    {
        const state = ownBoardState(makeView({ opponentShots: [miss(9, 9), hit(0, 1)] }));
        expect(state.marks).toEqual({ J10: "miss", B1: "hit" });
        expect(state.ships[0]).toEqual({ type: "carrier", x: 0, y: 0, orientation: "horizontal", status: "damaged" });
        expect(state.ships[1].status).toBe("intact");
        expect(state.lastShot).toBe("B1");
        expect(state.afloat).toBe(5);
    });

    it("marks every square of a sunk ship as sunk", () =>
    {
        const state = ownBoardState(makeView({ opponentShots: [hit(8, 0), sunk(8, 1, "Destroyer")] }));
        expect(state.marks).toMatchObject({ A9: "sunk", B9: "sunk" });
        expect(state.ships[4].status).toBe("sunk");
        expect(state.afloat).toBe(4);
    });
});

describe("targetBoardState", () =>
{
    it("shows your shots and keeps the ships afloat hidden", () =>
    {
        const state = targetBoardState(makeView({ yourShots: [miss(0, 0), hit(4, 4), hit(7, 7)] }));
        expect(state.marks).toEqual({ A1: "miss", E5: "hit", H8: "hit" });
        expect(state.ships).toEqual([]);
        expect(state.afloat).toBe(5);
        expect(state.total).toBe(5);
        expect(state.lastShot).toBe("H8");
    });

    it("draws a sunk ship in place, with every square marked sunk", () =>
    {
        const state = targetBoardState(makeView({
            yourShots: [miss(0, 0), hit(4, 4), sunk(4, 5, "Destroyer")],
            opponentSunkShips: [{ name: "Destroyer", row: 4, col: 4, orientation: "horizontal" }]
        }));
        expect(state.marks).toEqual({ A1: "miss", E5: "sunk", F5: "sunk" });
        expect(state.ships).toEqual([{ type: "destroyer", x: 4, y: 4, orientation: "horizontal", status: "sunk" }]);
        expect(state.afloat).toBe(4);
        expect(state.lastShot).toBe("F5");
    });

    it("has no last shot before the first one", () =>
    {
        expect(targetBoardState(makeView()).lastShot).toBeUndefined();
    });
});

describe("newLogEntries", () =>
{
    it("logs only the shots that are new, numbered on from the log", () =>
    {
        const before = makeView({ yourShots: [miss(0, 0)] });
        const after = makeView({ yourShots: [miss(0, 0), sunk(4, 5, "Destroyer")], opponentShots: [hit(2, 2)] });
        expect(newLogEntries(before, after, 3)).toEqual([
            { turn: 4, by: "you", coord: "F5", result: "sunk", ship: "destroyer" },
            { turn: 5, by: "opponent", coord: "C3", result: "hit", ship: undefined }
        ]);
    });

    it("logs nothing when a refetch brings the same shots", () =>
    {
        const view = makeView({ yourShots: [miss(0, 0)] });
        expect(newLogEntries(view, makeView({ yourShots: [miss(0, 0)] }), 1)).toEqual([]);
    });
});

describe("sunkNotice", () =>
{
    it("names a ship you sank", () =>
    {
        const before = makeView();
        expect(sunkNotice(before, makeView({ yourShots: [sunk(4, 5, "Cruiser")] }))).toEqual({ by: "you", ship: "cruiser" });
    });

    it("names a ship of yours they sank", () =>
    {
        const before = makeView({ opponentShots: [hit(8, 0)] });
        const after = makeView({ opponentShots: [hit(8, 0), sunk(8, 1, "Destroyer")] });
        expect(sunkNotice(before, after)).toEqual({ by: "opponent", ship: "destroyer" });
    });

    it("stays quiet for hits and misses", () =>
    {
        expect(sunkNotice(makeView(), makeView({ yourShots: [hit(1, 1)] }))).toBeNull();
    });
});

describe("finalEnemyBoardState", () =>
{
    const opponentBoard = {
        ships: [
            { name: "Destroyer", row: 4, col: 4, orientation: "horizontal" as const },
            { name: "Cruiser", row: 0, col: 0, orientation: "vertical" as const }
        ],
        shots: []
    };

    it("draws the ships you sank and leaves the rest hidden", () =>
    {
        const state = finalEnemyBoardState(makeView({
            opponentBoard,
            yourShots: [hit(4, 4), sunk(4, 5, "Destroyer"), hit(0, 0), miss(9, 9)]
        }));
        expect(state.ships).toEqual([{ type: "destroyer", x: 4, y: 4, orientation: "horizontal", status: "sunk" }]);
        expect(state.marks).toEqual({ E5: "sunk", F5: "sunk", A1: "hit", J10: "miss" });
        expect(state.afloat).toBe(1);
    });

    it("falls back to your shots while the board is still hidden", () =>
    {
        expect(finalEnemyBoardState(makeView({ yourShots: [miss(0, 0)] })).marks).toEqual({ A1: "miss" });
    });
});

describe("rematchState", () =>
{
    it("tells your request from theirs", () =>
    {
        expect(rematchState(makeView())).toBe("none");
        expect(rematchState(makeView({ rematch: { by: 1, status: RematchStatus.REQUESTED } }))).toBe("requested-by-you");
        expect(rematchState(makeView({ rematch: { by: 2, status: RematchStatus.REQUESTED } }))).toBe("requested-by-opponent");
        expect(rematchState(makeView({ rematch: { by: 2, status: RematchStatus.DECLINED } }))).toBe("declined");
        expect(rematchState(makeView({ rematch: { by: 1, status: RematchStatus.ACCEPTED } }))).toBe("accepted");
    });
});

describe("resultSummary", () =>
{
    it("waits for the server's result", () =>
    {
        expect(resultSummary(makeView())).toBeNull();
    });

    it("names the end reason for the summary", () =>
    {
        const view = makeView({
            endReason: EndReason.OPPONENT_FORFEIT,
            result: { won: true, shotsFired: 12, accuracy: 0.5, shipsSunk: 2 }
        });
        expect(resultSummary(view)).toEqual({ didWin: true, reason: "OPPONENT_FORFEIT", shotsFired: 12, accuracy: 0.5, shipsSunk: 2 });
    });
});

describe("abilityLogEntry", () =>
{
    it("logs an ability with its target square", () =>
    {
        expect(abilityLogEntry("you", "Line Scan", 2, { row: 3, col: 1 })).toEqual({
            turn: 2, by: "you", ability: "line-scan", coord: "B4", note: "used"
        });
    });

    it("logs Radar Sweep by the middle of its area, the square it was aimed at", () =>
    {
        // sent with the area's top left, B4
        expect(abilityLogEntry("you", "Radar Sweep", 2, { row: 3, col: 1 }).coord).toBe("C5");
    });
});
