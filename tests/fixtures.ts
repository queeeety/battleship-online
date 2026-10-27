import { Board, Coordinate } from "../lib/entities/board";
import { Carrier, Battleship, Cruiser, Submarine, Destroyer } from "../lib/entities/ships";
import type { Ship } from "../lib/entities/ships";
import { HumanPlayer } from "../lib/entities/players";
import type { Player } from "../lib/entities/players";
import { Game } from "../lib/controllers/Game";
import { GameType, Orientation } from "../lib/enums";

/**
 * Hand-placed boards and games for the unit tests.
 * Test-only, nothing in the app should use these.
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
