import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Game } from "../../lib/controllers/Game";
import { Coordinate } from "../../lib/entities/board";
import { Ability, DoubleShot, RadarSweep, Reroute } from "../../lib/abilities";
import { drawRandomAbility } from "../../lib/abilities/registry";
import { EndReason, GameState, GameType, ShotResult } from "../../lib/enums";
import { readyPlayer, startedGame, knownFleetSquares, OPEN_WATER, sinkDestroyer, allowAbility, gameWithAiToMove } from "../helpers";
import { AIOpponent, HumanPlayer } from "../../lib/entities/players";

// Teddy's registry isn't filled in yet, so the draw is controlled here
vi.mock("../../lib/abilities/registry", async importOriginal => ({
    ...await importOriginal<typeof import("../../lib/abilities/registry")>(),
    drawRandomAbility: vi.fn()
}));
const draw = vi.mocked(drawRandomAbility);

beforeEach(() => draw.mockImplementation(() => new RadarSweep()));
afterEach(() => vi.restoreAllMocks());

describe("Game setup", () =>
{
    it("seats at most two players, once each, during placement", () =>
    {
        const game = new Game(GameType.ORIGINAL);
        const a = readyPlayer("A");
        expect(game.addPlayer(a)).toBe(true);
        expect(game.addPlayer(a)).toBe(false);
        expect(game.addPlayer(readyPlayer("B"))).toBe(true);
        expect(game.addPlayer(readyPlayer("C"))).toBe(false);
    });

    it("won't begin until both players have confirmed a complete fleet", () =>
    {
        const game = new Game(GameType.ORIGINAL);
        game.addPlayer(readyPlayer("A"));
        const unready = new HumanPlayer("B", "s");
        game.addPlayer(unready);
        expect(unready.confirmPlacement()).toBe(false);
        expect(() => game.beginBattle()).toThrow();
        expect(game.getState()).toBe(GameState.PLACEMENT);
    });

    it("picks the starting player at random", () =>
    {
        const a = readyPlayer("A");
        const b = readyPlayer("B");

        vi.spyOn(Math, "random").mockReturnValue(0);
        const g1 = new Game(GameType.ORIGINAL);
        g1.addPlayer(a);
        g1.addPlayer(b);
        g1.beginBattle();
        expect(g1.getCurrentTurn()).toBe(a);

        vi.spyOn(Math, "random").mockReturnValue(0.99);
        const g2 = new Game(GameType.ORIGINAL);
        g2.addPlayer(a);
        g2.addPlayer(b);
        g2.beginBattle();
        expect(g2.getCurrentTurn()).toBe(b);
    });

    it("beginBattle starts the battle and the turn clock", () =>
    {
        const { game } = startedGame();
        expect(game.getState()).toBe(GameState.IN_PROGRESS);
        expect(game.getTurnStartedAt()).not.toBeNull();
    });
});

describe("Game turn order", () =>
{
    it("a hit fires again", () =>
    {
        const { game, first } = startedGame();
        expect(game.fireShot(first, new Coordinate(0, 0)).getResult()).toBe(ShotResult.HIT);
        expect(game.getCurrentTurn()).toBe(first);
    });

    it("a miss passes the turn", () =>
    {
        const { game, first, second } = startedGame();
        expect(game.fireShot(first, OPEN_WATER).getResult()).toBe(ShotResult.MISS);
        expect(game.getCurrentTurn()).toBe(second);
    });

    it("sinking a ship fires again", () =>
    {
        const { game, first } = startedGame();
        expect(sinkDestroyer(game, first).getResult()).toBe(ShotResult.SUNK);
        expect(game.getCurrentTurn()).toBe(first);
    });

    it("rejects a shot when it isn't the shooter's turn", () =>
    {
        const { game, second } = startedGame();
        expect(() => game.fireShot(second, OPEN_WATER)).toThrow();
        expect(game.getShots()).toHaveLength(0);
    });

    it("rejects a repeated square without using the turn", () =>
    {
        const { game, first } = startedGame();
        game.fireShot(first, new Coordinate(0, 0));
        expect(() => game.fireShot(first, new Coordinate(0, 0))).toThrow();
        expect(game.getCurrentTurn()).toBe(first);
        expect(game.getShots()).toHaveLength(1);
    });

    it("rejects shots before the battle starts", () =>
    {
        const game = new Game(GameType.ORIGINAL);
        const a = readyPlayer("A");
        game.addPlayer(a);
        game.addPlayer(readyPlayer("B"));
        expect(() => game.fireShot(a, OPEN_WATER)).toThrow();
    });

    it("Double Shot absorbs exactly one miss", () =>
    {
        const { game, first, second } = startedGame();
        game.setDoubleShotActive(true);
        game.fireShot(first, OPEN_WATER);
        expect(game.getCurrentTurn()).toBe(first);
        expect(game.isDoubleShotActive()).toBe(false);
        game.fireShot(first, new Coordinate(9, 8));
        expect(game.getCurrentTurn()).toBe(second);
    });

    it("Double Shot stays armed through hits", () =>
    {
        const { game, first } = startedGame();
        game.setDoubleShotActive(true);
        game.fireShot(first, new Coordinate(0, 0));
        expect(game.isDoubleShotActive()).toBe(true);
    });

    it("every shot restarts the turn clock, including a hit that fires again", () =>
    {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-01-01T12:00:00Z"));
        const { game, first } = startedGame(GameType.QUICK_FIRE);
        vi.setSystemTime(new Date("2026-01-01T12:00:04Z"));
        game.fireShot(first, new Coordinate(0, 0));
        expect(game.getTurnStartedAt()!.toISOString()).toBe("2026-01-01T12:00:04.000Z");
        vi.useRealTimers();
    });
});

describe("Game timer", () =>
{
    it.each([
        [GameType.BEGINNER, 30],
        [GameType.ORIGINAL, 15],
        [GameType.QUICK_FIRE, 5]
    ])("turn expires after the game type's limit (%s: %is)", (type, seconds) =>
    {
        const { game } = startedGame(type);
        const start = game.getTurnStartedAt()!.getTime();
        expect(game.isTurnExpired(new Date(start + seconds * 1000))).toBe(false);
        expect(game.isTurnExpired(new Date(start + seconds * 1000 + 1))).toBe(true);
    });

    it("resumeTurnTimer moves the start on by the time away, so the clock is paused", () =>
    {
        const { game } = startedGame();
        const start = game.getTurnStartedAt()!.getTime();
        game.resumeTurnTimer(20_000);
        expect(game.getTurnStartedAt()!.getTime()).toBe(start + 20_000);
        game.resumeTurnTimer(-5);
        expect(game.getTurnStartedAt()!.getTime()).toBe(start + 20_000);
    });

    it("fireRandomShot fires for the current player at an untargeted square", () =>
    {
        const { game, first, second } = startedGame();
        const board = second.getBoard();
        const before = board.getUntargetedCoordinates().length;
        const shot = game.fireRandomShot(first);
        expect(shot.getShooter()).toBe(first);
        expect(board.getUntargetedCoordinates()).toHaveLength(before - 1);
    });
});

describe("Game win and forfeit", () =>
{
    it("sinking the last ship wins with FLEET_DESTROYED and grants nothing", () =>
    {
        const { game, first, second } = startedGame();
        for (const c of knownFleetSquares()) game.fireShot(first, c);

        expect(game.getState()).toBe(GameState.FINISHED);
        expect(game.getWinner()).toBe(first);
        expect(game.getEndReason()).toBe(EndReason.FLEET_DESTROYED);
        expect(game.getFinishedAt()).not.toBeNull();
        expect(game.checkWinCondition()).toBe(true);
        // four earlier sinks drew an ability, the fifth ended the game first
        expect(draw).toHaveBeenCalledTimes(4);
        expect(second.getHeldAbility()).toBeNull();
    });

    it("no shots are accepted once the game is finished", () =>
    {
        const { game, first } = startedGame();
        for (const c of knownFleetSquares()) game.fireShot(first, c);
        expect(() => game.fireShot(first, OPEN_WATER)).toThrow();
    });

    it("forfeit makes the opponent the winner", () =>
    {
        const { game, first, second } = startedGame();
        game.forfeit(first);
        expect(game.getWinner()).toBe(second);
        expect(game.getEndReason()).toBe(EndReason.OPPONENT_FORFEIT);
    });

    it("resultFor counts shots, accuracy and ships sunk per player", () =>
    {
        const { game, first, second } = startedGame();
        sinkDestroyer(game, first);          // 2 shots, 2 hits, 1 sunk
        game.fireShot(first, OPEN_WATER);    // miss, turn passes
        game.fireShot(second, OPEN_WATER);   // miss
        game.forfeit(second);

        const mine = game.resultFor(first);
        expect(mine.getDidWin()).toBe(true);
        expect(mine.getShotsFired()).toBe(3);
        expect(mine.getAccuracy()).toBeCloseTo(2 / 3);
        expect(mine.getShipsSunk()).toBe(1);

        const theirs = game.resultFor(second);
        expect(theirs.getDidWin()).toBe(false);
        expect(theirs.getAccuracy()).toBe(0);
    });
});

describe("Game abilities", () =>
{
    it("a sunk ship grants an ability to its owner, not the shooter", () =>
    {
        const { game, first, second } = startedGame();
        sinkDestroyer(game, first);
        expect(second.getHeldAbility()).toBeInstanceOf(RadarSweep);
        expect(first.getHeldAbility()).toBeNull();
    });

    it("a second sink while holding one becomes an offer, and a third replaces the offer", () =>
    {
        const { game, first, second } = startedGame();
        draw.mockImplementationOnce(() => new RadarSweep())
            .mockImplementationOnce(() => new DoubleShot())
            .mockImplementationOnce(() => new RadarSweep());

        sinkDestroyer(game, first);
        [0, 1, 2].forEach(x => game.fireShot(first, new Coordinate(x, 3)));   // Submarine
        expect(second.getHeldAbility()).toBeInstanceOf(RadarSweep);
        expect(second.getOfferedAbility()).toBeInstanceOf(DoubleShot);

        [0, 1, 2].forEach(x => game.fireShot(first, new Coordinate(x, 2)));   // Cruiser
        expect(second.getOfferedAbility()).toBeInstanceOf(RadarSweep);
    });

    it("redraws from the other three when Reroute has nowhere to go", () =>
    {
        const { game, first, second } = startedGame();
        draw.mockImplementationOnce(() => new Reroute()).mockImplementationOnce(() => new DoubleShot());
        vi.spyOn(Reroute.prototype, "validPositions").mockReturnValue([]);

        sinkDestroyer(game, first);
        expect(draw).toHaveBeenLastCalledWith(["Reroute"]);
        expect(second.getHeldAbility()).toBeInstanceOf(DoubleShot);
    });

    it("keeps Reroute when an undamaged ship can move", () =>
    {
        const { game, first, second } = startedGame();
        draw.mockImplementationOnce(() => new Reroute());
        vi.spyOn(Reroute.prototype, "validPositions").mockReturnValue([new Coordinate(9, 0)]);

        sinkDestroyer(game, first);
        expect(second.getHeldAbility()).toBeInstanceOf(Reroute);
        expect(draw).toHaveBeenCalledTimes(1);
    });

    it("applying a scan uses the turn's shot and discards the ability", () =>
    {
        const { game, first, second } = startedGame();
        first.receiveAbility(new RadarSweep());
        const apply = allowAbility(RadarSweep).mockImplementation(() => {});

        game.applyAbility(first, new Coordinate(4, 4));
        expect(apply).toHaveBeenCalledWith(game, second.getBoard(), expect.any(Coordinate));
        expect(first.getHeldAbility()).toBeNull();
        expect(game.getCurrentTurn()).toBe(second);
    });

    it("Double Shot doesn't use the turn's shot", () =>
    {
        const { game, first } = startedGame();
        first.receiveAbility(new DoubleShot());
        allowAbility(DoubleShot).mockImplementation((g: Game) => g.setDoubleShotActive(true));

        game.applyAbility(first, new Coordinate(0, 0));
        expect(game.getCurrentTurn()).toBe(first);
        expect(game.isDoubleShotActive()).toBe(true);
    });

    it("Reroute is applied to the player's own board", () =>
    {
        const { game, first } = startedGame();
        first.receiveAbility(new Reroute());
        const apply = allowAbility(Reroute).mockImplementation(() => {});

        game.applyAbility(first, new Coordinate(9, 0));
        expect(apply).toHaveBeenCalledWith(game, first.getBoard(), expect.any(Coordinate));
    });

    it("an invalid target is rejected and the ability is kept", () =>
    {
        const { game, first } = startedGame();
        first.receiveAbility(new RadarSweep());
        vi.spyOn(Ability.prototype, "canUse").mockReturnValue(true);
        vi.spyOn(RadarSweep.prototype, "isValidTarget").mockReturnValue(false);

        expect(() => game.applyAbility(first, new Coordinate(8, 8))).toThrow();
        expect(first.getHeldAbility()).toBeInstanceOf(RadarSweep);
        expect(game.getCurrentTurn()).toBe(first);
    });

    it("abilities can only be used on your own turn", () =>
    {
        const { game, second } = startedGame();
        second.receiveAbility(new RadarSweep());
        expect(() => game.applyAbility(second, new Coordinate(0, 0))).toThrow();
    });

    it("abilities are discarded when the game ends", () =>
    {
        const { game, first, second } = startedGame();
        first.receiveAbility(new RadarSweep());
        second.receiveAbility(new DoubleShot());
        second.receiveAbility(new RadarSweep());
        game.forfeit(first);
        expect(first.getHeldAbility()).toBeNull();
        expect(second.getHeldAbility()).toBeNull();
        expect(second.getOfferedAbility()).toBeNull();
    });
});

// a save and load as the AI-mode reducer does it, through a JSON string
function reload(game: Game): Game
{
    return Game.fromJSON(JSON.parse(JSON.stringify(game)));
}

describe("Game save and restore", () =>
{
    it("a game in placement round-trips unchanged", () =>
    {
        const game = new Game(GameType.BEGINNER);
        game.addPlayer(readyPlayer("Aoife"));
        expect(reload(game).toJSON()).toEqual(game.toJSON());
    });

    it("a battle in progress round-trips: turn, shots, boards, abilities and Double Shot", () =>
    {
        const { game, first, second } = startedGame(GameType.QUICK_FIRE);
        sinkDestroyer(game, first);                 // grants second a Radar Sweep
        game.fireShot(first, new Coordinate(0, 0));
        second.receiveAbility(new DoubleShot());     // becomes an offer
        game.setDoubleShotActive(true);

        const restored = reload(game);
        expect(restored.toJSON()).toEqual(game.toJSON());
        expect(restored.getCurrentTurn()!.getId()).toBe(first.getId());
        expect(restored.isDoubleShotActive()).toBe(true);
        expect(restored.getTurnStartedAt()!.getTime()).toBe(game.getTurnStartedAt()!.getTime());

        const restoredSecond = restored.opponentOf(restored.getCurrentTurn()!);
        expect(restoredSecond.getHeldAbility()).toBeInstanceOf(RadarSweep);
        expect(restoredSecond.getOfferedAbility()).toBeInstanceOf(DoubleShot);
        expect(restoredSecond.getBoard().getShips().find(s => s.getName() === "Carrier")!.getHits()).toBe(1);
    });

    it("restored shots point at the restored players, so results still add up", () =>
    {
        const { game, first, second } = startedGame();
        sinkDestroyer(game, first);
        game.fireShot(first, OPEN_WATER);
        game.fireShot(second, OPEN_WATER);

        const restored = reload(game);
        const [p1, p2] = restored.getPlayers();
        expect(restored.getShots().every(s => restored.getPlayers().includes(s.getShooter()))).toBe(true);
        expect(restored.resultFor(p1)).toEqual(game.resultFor(game.getPlayers()[0]));
        expect(restored.resultFor(p2)).toEqual(game.resultFor(game.getPlayers()[1]));
    });

    it("a restored game carries on with the same rules", () =>
    {
        const { game, first } = startedGame();
        game.fireShot(first, new Coordinate(0, 0));

        const restored = reload(game);
        const shooter = restored.getCurrentTurn()!;
        expect(() => restored.fireShot(shooter, new Coordinate(0, 0))).toThrow();   // already shot before saving
        expect(restored.fireShot(shooter, new Coordinate(1, 0)).getResult()).toBe(ShotResult.HIT);
        expect(restored.getCurrentTurn()).toBe(shooter);
    });

    it("a finished game keeps its winner, end reason and finish time", () =>
    {
        const { game, first, second } = startedGame();
        game.forfeit(second);

        const restored = reload(game);
        expect(restored.getState()).toBe(GameState.FINISHED);
        expect(restored.getWinner()!.getId()).toBe(first.getId());
        expect(restored.getEndReason()).toBe(EndReason.OPPONENT_FORFEIT);
        expect(restored.getFinishedAt()!.getTime()).toBe(game.getFinishedAt()!.getTime());
    });

    it("an AI opponent comes back as an AI with its memory and its fleet", () =>
    {
        const { game, ai } = gameWithAiToMove();
        for (let i = 0; i < 5 && game.getCurrentTurn() === ai; i++) ai.takeTurn(game);

        const restored = reload(game);
        const restoredAi = restored.getPlayers()[1];
        expect(restoredAi).toBeInstanceOf(AIOpponent);
        expect((restoredAi as AIOpponent).toJSON()).toEqual(ai.toJSON());
        expect(restoredAi.getBoard().toSnapshot()).toEqual(ai.getBoard().toSnapshot());
        expect(restoredAi.getId()).toBe(ai.getId());
    });

    it("a human keeps their name and session id", () =>
    {
        const { game } = startedGame();
        const restored = reload(game).getPlayers()[0] as HumanPlayer;
        expect(restored).toBeInstanceOf(HumanPlayer);
        expect(restored.getName()).toBe(game.getPlayers()[0].getName());
        expect(restored.getSessionId()).toBe((game.getPlayers()[0] as HumanPlayer).getSessionId());
    });

    it("rejects a saved ability it doesn't know", () =>
    {
        const { game } = startedGame();
        const saved = game.toJSON();
        saved.players[0].heldAbility = "Nuke";
        expect(() => Game.fromJSON(saved)).toThrow();
    });
});
