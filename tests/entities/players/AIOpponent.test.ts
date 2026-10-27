import { describe, it, expect, vi, afterEach } from "vitest";
import { AIOpponent } from "../../../lib/entities/players/AIOpponent";
import { Board, Coordinate } from "../../../lib/entities/board";
import { Game } from "../../../lib/controllers/Game";
import { DoubleShot, LineScan, RadarSweep, Reroute } from "../../../lib/abilities";
import { Difficulty, GameState, GameType, Orientation } from "../../../lib/enums";
import { placeKnownFleet } from "../../fixtures";

// Teddy's registry isn't filled in yet, so sinks draw a fixed ability
vi.mock("../../../lib/abilities/registry", () => ({ drawRandomAbility: vi.fn(() => new RadarSweep()) }));

afterEach(() => vi.restoreAllMocks());

// fires the AI at the board and feeds it the result, like Game does
function fireAt(ai: AIOpponent, board: Board)
{
    const target = ai.chooseTarget();
    const shot = board.receiveShot(target, ai);
    ai.recordShot(shot);
    return shot;
}

describe("AIOpponent", () =>
{
    it.each([Difficulty.EASY, Difficulty.NORMAL])("never repeats a square and covers all 100 (difficulty %s)", difficulty =>
    {
        const ai = new AIOpponent(difficulty);
        const board = new Board();
        board.placeFleetRandomly();
        const seen = new Set<string>();
        for (let i = 0; i < 100; i++)
        {
            const shot = fireAt(ai, board);
            expect(seen.has(shot.getCoordinate().key())).toBe(false);
            seen.add(shot.getCoordinate().key());
        }
        expect(seen.size).toBe(100);
        expect(() => ai.chooseTarget()).toThrow();
    });

    it("Easy ignores hits and keeps firing at random", () =>
    {
        const ai = new AIOpponent(Difficulty.EASY);
        const board = placeKnownFleet();
        vi.spyOn(Math, "random").mockReturnValue(0);
        // with random fixed at 0 Easy always takes the first open square, even right after a hit
        expect(fireAt(ai, board).getCoordinate().key()).toBe("0,0");
        expect(ai.chooseTarget().key()).toBe("1,0");
        expect(ai.toJSON().huntQueue).toEqual([]);
    });

    it("Normal hunts only on the checkerboard while nothing is hit", () =>
    {
        const ai = new AIOpponent(Difficulty.NORMAL);
        const board = new Board();   // no ships, so every shot misses
        for (let i = 0; i < 50; i++)
        {
            const c = fireAt(ai, board).getCoordinate();
            expect((c.getX() + c.getY()) % 2).toBe(0);
        }
        // the checkerboard is used up, so it falls back to the other half
        const next = ai.chooseTarget();
        expect((next.getX() + next.getY()) % 2).toBe(1);
    });

    it("Normal switches to the neighbours of a hit", () =>
    {
        const ai = new AIOpponent(Difficulty.NORMAL);
        const board = placeKnownFleet();
        vi.spyOn(Math, "random").mockReturnValue(0);
        expect(fireAt(ai, board).getCoordinate().key()).toBe("0,0");   // Carrier hit
        vi.restoreAllMocks();

        const next = ai.chooseTarget();
        expect(["1,0", "0,1"]).toContain(next.key());
    });

    it("Normal sinks a ship it has found, then goes back to hunting", () =>
    {
        const ai = new AIOpponent(Difficulty.NORMAL);
        const board = new Board();
        const fleet = placeKnownFleet();
        const destroyer = fleet.getShips().find(s => s.getName() === "Destroyer")!;
        fleet.removeShip(destroyer);
        board.placeShip(destroyer, new Coordinate(4, 4), Orientation.HORIZONTAL);

        // force the first hunt shot onto the Destroyer
        const hit = board.receiveShot(new Coordinate(4, 4), ai);
        ai.recordShot(hit);

        let shots = 0;
        while (!destroyer.isSunk() && shots < 4)
        {
            fireAt(ai, board);
            shots++;
        }
        expect(destroyer.isSunk()).toBe(true);
        expect(ai.toJSON().activeHits).toEqual([]);

        const next = ai.chooseTarget();
        expect((next.getX() + next.getY()) % 2).toBe(0);
    });

    it("Normal keeps chasing a second ship hit while sinking the first", () =>
    {
        const ai = new AIOpponent(Difficulty.NORMAL);
        const board = placeKnownFleet();
        // hit the Submarine (row 4) and Destroyer (row 5) on column A, then sink the Destroyer
        for (const c of [new Coordinate(0, 3), new Coordinate(0, 4), new Coordinate(1, 4)])
        {
            ai.recordShot(board.receiveShot(c, ai));
        }
        expect(ai.toJSON().activeHits).toEqual([{ x: 0, y: 3 }]);
        expect(ai.toJSON().huntQueue.length).toBeGreaterThan(0);
    });

    it("Normal finishes a full random fleet well under 100 shots on average", () =>
    {
        let total = 0;
        for (let game = 0; game < 20; game++)
        {
            const ai = new AIOpponent(Difficulty.NORMAL);
            const board = new Board();
            board.placeFleetRandomly();
            let shots = 0;
            while (!board.allShipsSunk())
            {
                fireAt(ai, board);
                shots++;
            }
            total += shots;
        }
        expect(total / 20).toBeLessThan(75);
    });

    it("shouldUseAbility: scans while hunting, Double Shot while chasing, Reroute right away", () =>
    {
        const ai = new AIOpponent(Difficulty.NORMAL);
        expect(ai.shouldUseAbility()).toBe(false);

        ai.receiveAbility(new RadarSweep());
        expect(ai.shouldUseAbility()).toBe(true);
        ai.consumeAbility();

        ai.receiveAbility(new DoubleShot());
        expect(ai.shouldUseAbility()).toBe(false);
        ai.recordShot(placeKnownFleet().receiveShot(new Coordinate(0, 0), ai));
        expect(ai.shouldUseAbility()).toBe(true);
        ai.consumeAbility();

        ai.receiveAbility(new LineScan());
        expect(ai.shouldUseAbility()).toBe(false);
        ai.consumeAbility();

        ai.receiveAbility(new Reroute());
        expect(ai.shouldUseAbility()).toBe(true);
    });

    it("aims Radar Sweep at the 3x3 area with the most unknown squares", () =>
    {
        const ai = new AIOpponent(Difficulty.NORMAL);
        const board = new Board();
        for (let y = 0; y < 3; y++) for (let x = 0; x < 10; x++) ai.recordShot(board.receiveShot(new Coordinate(x, y), ai));
        ai.receiveAbility(new RadarSweep());
        const corner = ai.chooseAbilityTarget();
        expect(corner.getY()).toBeGreaterThanOrEqual(3);
        expect(corner.isWithinBounds(8, 8)).toBe(true);
    });

    it("aims Line Scan at the row with the most unknown squares", () =>
    {
        const ai = new AIOpponent(Difficulty.NORMAL);
        const board = new Board();
        for (let y = 0; y < 10; y++) if (y !== 6) ai.recordShot(board.receiveShot(new Coordinate(0, y), ai));
        ai.receiveAbility(new LineScan());
        expect(ai.chooseAbilityTarget().getY()).toBe(6);
    });

    it("memory survives a round trip through JSON", () =>
    {
        const ai = new AIOpponent(Difficulty.NORMAL);
        const board = placeKnownFleet();
        ai.recordShot(board.receiveShot(new Coordinate(0, 0), ai));
        ai.recordShot(board.receiveShot(new Coordinate(9, 9), ai));

        const restored = AIOpponent.fromJSON(JSON.parse(JSON.stringify(ai)));
        expect(restored.toJSON()).toEqual(ai.toJSON());
        expect(restored.getDifficulty()).toBe(Difficulty.NORMAL);
    });

    it("plays a complete game against another AI through Game", () =>
    {
        const game = new Game(GameType.BEGINNER);
        const a = new AIOpponent(Difficulty.NORMAL);
        const b = new AIOpponent(Difficulty.EASY);
        for (const ai of [a, b])
        {
            ai.getBoard().placeFleetRandomly();
            expect(ai.confirmPlacement()).toBe(true);
            game.addPlayer(ai);
        }
        game.beginBattle();

        let guard = 0;
        while (game.getState() === GameState.IN_PROGRESS && guard++ < 200)
        {
            const shooter = game.getCurrentTurn()!;
            game.fireShot(shooter, shooter.chooseTarget());
        }

        expect(game.getState()).toBe(GameState.FINISHED);
        const winner = game.getWinner()!;
        expect(game.opponentOf(winner).hasLost()).toBe(true);
        expect(game.resultFor(winner).getShipsSunk()).toBe(5);
        expect(game.resultFor(a).getShotsFired()).toBeLessThanOrEqual(100);
        expect(game.resultFor(b).getShotsFired()).toBeLessThanOrEqual(100);
    });
});
