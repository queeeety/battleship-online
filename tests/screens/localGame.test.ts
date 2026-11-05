import { describe, it, expect } from "vitest";
import {
    applyLocalAbility,
    computerMove,
    computerOf,
    fireIfExpired,
    humanOf,
    localView,
    newLocalGame,
    resumeAfterAway,
    startBattle,
    withScanned
} from "../../components/screens/localGame";
import { screenFor } from "../../components/screens/screenFor";
import type { Layout } from "../../components/screens/placement";
import { Game } from "../../lib/controllers/Game";
import { Lobby } from "../../lib/controllers/Lobby";
import { Server, type PlayerView } from "../../lib/controllers/Server";
import { Board, Coordinate } from "../../lib/entities/board";
import { DoubleShot, LineScan, RadarSweep, Reroute } from "../../lib/abilities";
import { TURN_TIME_LIMIT_SECONDS } from "../../lib/config";
import { Difficulty, GameState, GameType, Orientation } from "../../lib/enums";

const layout: Layout = [
    { name: "Carrier", row: 0, col: 0, orientation: "horizontal" },
    { name: "Battleship", row: 2, col: 0, orientation: "horizontal" },
    { name: "Cruiser", row: 4, col: 0, orientation: "horizontal" },
    { name: "Submarine", row: 6, col: 0, orientation: "horizontal" },
    { name: "Destroyer", row: 8, col: 0, orientation: "horizontal" }
];

// a battle with the computer's fleet in the same known spots, and your turn
function battle(): Game
{
    const game = newLocalGame(Difficulty.NORMAL, GameType.ORIGINAL);
    computerOf(game).placeFleet(Board.fromSnapshot({ ships: layout, shots: [] }));
    computerOf(game).confirmPlacement();
    startBattle(game, layout);
    if (game.getCurrentTurn() !== humanOf(game)) game.switchTurn();
    return game;
}

describe("local game", () =>
{
    it("starts in placement with the computer already ready", () =>
    {
        const view = localView(newLocalGame(Difficulty.EASY, GameType.QUICK_FIRE), []);
        expect(view.gameState).toBe(GameState.PLACEMENT);
        expect(view.opponent).toMatchObject({ name: "Computer", ready: true, connected: true });
        expect(view.gameType).toBe(GameType.QUICK_FIRE);
        expect(screenFor({ view, notSeated: false, wasSeated: true })).toBe("placement");
    });

    it("refuses Ready with ships missing", () =>
    {
        expect(() => startBattle(newLocalGame(Difficulty.EASY, GameType.ORIGINAL), layout.slice(1))).toThrow();
    });

    it("shows your shots and keeps the computer's fleet hidden until the end", () =>
    {
        const game = battle();
        game.fireShot(humanOf(game), Coordinate.fromRowCol(0, 0));
        const view = localView(game, []);
        expect(view.yourShots).toEqual([{ row: 0, col: 0, result: expect.any(Number), sunkShipName: null }]);
        expect(view.yourTurn).toBe(true);
        expect(view.opponentBoard).toBeNull();
        expect(view.yourBoard.ships).toHaveLength(5);
    });

    it("reveals the computer's fleet and your result once you forfeit", () =>
    {
        const game = battle();
        game.forfeit(humanOf(game));
        const view = localView(game, []);
        expect(view.opponentBoard?.ships).toHaveLength(5);
        expect(view.result).toMatchObject({ won: false, shotsFired: 0 });
        expect(view.winner).toBe(2);
        expect(screenFor({ view, notSeated: false, wasSeated: true })).toBe("result");
    });

    it("scans with your Radar Sweep and lists only the unshot ship squares", () =>
    {
        const game = battle();
        humanOf(game).receiveAbility(new RadarSweep());
        const found = applyLocalAbility(game, { name: "Radar Sweep" }, { row: 0, col: 0 });
        expect(found.map(c => c.toRowCol())).toEqual(expect.arrayContaining([{ row: 0, col: 0 }, { row: 2, col: 2 }]));
        expect(localView(game, found.map(c => c.toRowCol())).revealedSquares).toHaveLength(found.length);
        // the scan used the turn's shot
        expect(game.getCurrentTurn()).toBe(computerOf(game));
    });

    it("refuses an ability you don't hold and changes nothing", () =>
    {
        const game = battle();
        expect(() => applyLocalAbility(game, { name: "Radar Sweep" }, { row: 0, col: 0 })).toThrow();
        expect(game.getCurrentTurn()).toBe(humanOf(game));
    });

    it("comes back the same after a save to JSON", () =>
    {
        const game = battle();
        game.fireShot(humanOf(game), Coordinate.fromRowCol(0, 1));
        const restored = Game.fromJSON(JSON.parse(JSON.stringify(game.toJSON())));
        expect(localView(restored, [])).toEqual(localView(game, []));
    });

    it("refuses a scan without a target", () =>
    {
        const game = battle();
        humanOf(game).receiveAbility(new RadarSweep());
        expect(() => applyLocalAbility(game, { name: "Radar Sweep" })).toThrow();
    });

    it("refuses Ready once the battle is on", () =>
    {
        expect(() => startBattle(battle(), layout)).toThrow();
    });

    it("comes back the same after a save to JSON, abilities, offers and all", () =>
    {
        const game = battle();
        game.fireShot(humanOf(game), Coordinate.fromRowCol(0, 1));
        humanOf(game).receiveAbility(new LineScan());
        humanOf(game).receiveAbility(new DoubleShot());
        computerOf(game).receiveAbility(new RadarSweep());
        game.setDoubleShotActive(true);

        const restored = Game.fromJSON(JSON.parse(JSON.stringify(game.toJSON())));
        expect(localView(restored, [{ row: 9, col: 9 }])).toEqual(localView(game, [{ row: 9, col: 9 }]));
        expect(localView(restored, []).offeredAbility).toBe("Double Shot");
        expect(computerOf(restored).getHeldAbility()?.getName()).toBe("Radar Sweep");
        expect(computerOf(restored).getDifficulty()).toBe(Difficulty.NORMAL);
    });
});

describe("local game clock", () =>
{
    const limitMs = TURN_TIME_LIMIT_SECONDS[GameType.ORIGINAL] * 1000;

    it("gives the time away back, so a resumed turn hasn't run out", () =>
    {
        const game = battle();
        const start = game.getTurnStartedAt()!.getTime();
        const later = start + 10 * limitMs;
        expect(game.isTurnExpired(new Date(later))).toBe(true);

        // put away 2 s into the turn, back much later: 2 s gone, the rest still to play
        resumeAfterAway(game, start + 2000, later);
        expect(game.isTurnExpired(new Date(later))).toBe(false);
        expect(game.getTurnStartedAt()!.getTime()).toBe(later - 2000);
    });

    it("counts from the turn's start when it began after the game was put away", () =>
    {
        const game = battle();
        const start = game.getTurnStartedAt()!.getTime();
        resumeAfterAway(game, 0, start + 5000);
        expect(game.getTurnStartedAt()!.getTime()).toBe(start + 5000);
    });

    it("leaves a game that isn't being played alone", () =>
    {
        const game = newLocalGame(Difficulty.EASY, GameType.ORIGINAL);
        resumeAfterAway(game, 0, Date.now());
        expect(game.getTurnStartedAt()).toBeNull();
    });

    it("fires the random shot only once the turn has run out", () =>
    {
        const game = battle();
        const start = game.getTurnStartedAt()!.getTime();
        expect(fireIfExpired(game, new Date(start + 1000))).toBe(false);
        expect(game.getShots()).toHaveLength(0);

        expect(fireIfExpired(game, new Date(start + limitMs + 1))).toBe(true);
        expect(game.getShots()).toHaveLength(1);
        expect(game.getShots()[0].getShooter()).toBe(humanOf(game));
    });
});

describe("the computer's move", () =>
{
    // the computer's turn, with the destroyer (row 8, cols 0-1) free to move and your scan on it
    function computerToMove(): Game
    {
        const game = battle();
        game.switchTurn();
        return game;
    }

    it("lists each scanned square once", () =>
    {
        expect(withScanned([{ row: 0, col: 0 }], [{ row: 0, col: 0 }, { row: 0, col: 1 }])).toEqual([
            { row: 0, col: 0 },
            { row: 0, col: 1 }
        ]);
    });

    it("takes your contacts off a ship it reroutes, like the server", () =>
    {
        const game = computerToMove();
        const computer = computerOf(game);
        const destroyer = computer.getBoard().getShips().find(s => s.getName() === "Destroyer")!;
        const scanned = [{ row: 8, col: 0 }, { row: 8, col: 1 }, { row: 0, col: 0 }];

        // the computer's own choices are random, so this one is scripted: move the destroyer one
        // square right, which overlaps where it was
        const reroute = new Reroute();
        computer.receiveAbility(reroute);
        computer.takeTurn = (g: Game) =>
        {
            reroute.selectShip(destroyer);
            reroute.setOrientation(Orientation.HORIZONTAL);
            g.applyAbility(computer, Coordinate.fromRowCol(8, 1));
            return null;
        };

        const moved = computerMove(game, scanned);
        expect(destroyer.getCoordinates().map(c => c.toRowCol())).toEqual([{ row: 8, col: 1 }, { row: 8, col: 2 }]);
        expect(moved.used).toBe("Reroute");
        // both old squares go, even the one the ship still covers, and the other contact stays
        expect(moved.scanned).toEqual([{ row: 0, col: 0 }]);
        expect(localView(game, moved.scanned).revealedSquares).toEqual([{ row: 0, col: 0 }]);
    });

    it("says nothing when it just fires", () =>
    {
        const game = computerToMove();
        const moved = computerMove(game, [{ row: 0, col: 0 }]);
        expect(moved.used).toBeNull();
        expect(game.getShots()).toHaveLength(1);
    });
});

describe("local view", () =>
{
    // the server's viewFor is private; reached here only to check the local copy matches it
    const viewFor = (Server as unknown as {
        viewFor: (lobby: Lobby, game: Game, seat: 1 | 2, rematch: null, scanned: { row: number; col: number }[]) => PlayerView;
    }).viewFor;

    it("matches the server's view of the same game", () =>
    {
        const lobby = new Lobby(GameType.ORIGINAL, "ABC123");
        lobby.join("You", "s1");
        lobby.join("Teddy", "s2");
        const game = lobby.getGame();
        for (const p of game.getPlayers())
        {
            p.placeFleet(Board.fromSnapshot({ ships: layout, shots: [] }));
            p.confirmPlacement();
        }
        game.beginBattle();
        const [you, them] = game.getPlayers();
        if (game.getCurrentTurn() !== you) game.switchTurn();
        game.fireShot(you, Coordinate.fromRowCol(0, 0));
        game.fireShot(you, Coordinate.fromRowCol(9, 9));
        game.fireShot(them, Coordinate.fromRowCol(2, 0));
        them.receiveAbility(new RadarSweep());
        them.receiveAbility(new LineScan());

        const scanned = [{ row: 0, col: 0 }, { row: 4, col: 2 }];
        const server = viewFor(lobby, game, 1, null, scanned);
        const local = localView(game, scanned);
        // seats, code and lobby status come from the lobby, which the local game hasn't got
        const lobbyFields = new Set(["code", "lobbyStatus", "you", "opponent"]);
        const rest = Object.fromEntries(Object.entries(server).filter(([key]) => !lobbyFields.has(key)));
        expect(local).toMatchObject(rest);
        expect(local.revealedSquares).toEqual([{ row: 4, col: 2 }]);
    });
});
