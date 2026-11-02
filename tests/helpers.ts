import { vi } from "vitest";
import { Board, Coordinate } from "../lib/entities/board";
import { Carrier, Battleship, Cruiser, Submarine, Destroyer } from "../lib/entities/ships";
import type { Ship } from "../lib/entities/ships";
import { AIOpponent, HumanPlayer } from "../lib/entities/players";
import type { Player } from "../lib/entities/players";
import type { Shot } from "../lib/entities/game";
import { Game } from "../lib/controllers/Game";
import { Ability } from "../lib/abilities";
import { Difficulty, GameType, Orientation } from "../lib/enums";

/**
 * Shared boards, games and mocks for the unit tests.
 * Test-only, nothing in the app should use these.
 * Helpers that only one test file needs stay in that file.
 */

// every ship horizontal from column A: Carrier on row 1, Battleship row 2, ..., Destroyer row 5
export function placeKnownFleet(b: Board = new Board()): Board
{
    const ships: Ship[] = [new Carrier(), new Battleship(), new Cruiser(), new Submarine(), new Destroyer()];
    ships.forEach((s, row) =>
    {
        if (!b.placeShip(s, new Coordinate(0, row), Orientation.HORIZONTAL)) throw new Error("fixture fleet didn't fit");
    });
    return b;
}

// the squares of the known fleet, in the order to sink every ship
export function knownFleetSquares(): Coordinate[]
{
    const lengths = [5, 4, 3, 3, 2];
    return lengths.flatMap((length, row) => Array.from({ length }, (_, x) => new Coordinate(x, row)));
}

// a square the known fleet never covers
export const OPEN_WATER = new Coordinate(9, 9);

export function readyPlayer(name: string, board: Board = placeKnownFleet()): Player
{
    const p = new HumanPlayer(name, `session-${name}`);
    p.placeFleet(board);
    p.confirmPlacement();
    return p;
}

// a game in progress where `first` has the first turn
export function startedGame(type: GameType = GameType.ORIGINAL): { game: Game; first: Player; second: Player }
{
    const game = new Game(type);
    const a = readyPlayer("Aoife");
    const b = readyPlayer("Cian");
    game.addPlayer(a);
    game.addPlayer(b);
    game.beginBattle();
    const first = game.getCurrentTurn() as Player;
    return { game, first, second: game.opponentOf(first) };
}

// a game against a human with the known fleet, where the AI has the first turn
export function gameWithAiToMove(difficulty: Difficulty = Difficulty.NORMAL): { game: Game; ai: AIOpponent; human: Player }
{
    const human = readyPlayer("Aoife");
    const ai = new AIOpponent(difficulty);
    const game = new Game(GameType.ORIGINAL);
    game.addPlayer(human);
    game.addPlayer(ai);
    vi.spyOn(Math, "random").mockReturnValueOnce(0.99);   // makes the second player, the AI, go first
    game.beginBattle();
    return { game, ai, human };
}

// sinks the opponent's Destroyer (row 5, columns A-B in the known fleet)
export function sinkDestroyer(game: Game, shooter: Player): Shot
{
    game.fireShot(shooter, new Coordinate(0, 4));
    return game.fireShot(shooter, new Coordinate(1, 4));
}

// lets an ability pass Teddy's canUse and isValidTarget checks, and returns a spy on its apply
// so the test can decide what applying it does. Mocks are undone by vi.restoreAllMocks().
export function allowAbility(kind: { prototype: Ability })
{
    vi.spyOn(Ability.prototype, "canUse").mockReturnValue(true);
    vi.spyOn(kind.prototype, "isValidTarget").mockReturnValue(true);
    return vi.spyOn(kind.prototype, "apply");
}
