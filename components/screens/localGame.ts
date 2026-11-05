import { LineScan, RadarSweep, Reroute } from "@/lib/abilities";
import { Game } from "@/lib/controllers/Game";
import type { PlayerView } from "@/lib/controllers/Server";
import { Board, Coordinate } from "@/lib/entities/board";
import { AIOpponent, HumanPlayer, type Player } from "@/lib/entities/players";
import { Difficulty, GameState, GameType, LobbyStatus, Orientation } from "@/lib/enums";
import type { AbilityRequest } from "@/lib/server/RequestValidator";
import type { Layout } from "./placement";

// the game against the computer, on lib's Game classes, shaped into a PlayerView for the screens

type Square = { row: number; col: number };

/** You in seat 1, the computer (fleet already placed) in seat 2. */
export function newLocalGame(difficulty: Difficulty, gameType: GameType): Game {
  const game = new Game(gameType);
  game.addPlayer(new HumanPlayer("You", "local"));
  game.addPlayer(new AIOpponent(difficulty));
  return game;
}

export function humanOf(game: Game): Player {
  return game.getPlayers()[0];
}

export function computerOf(game: Game): AIOpponent {
  return game.getPlayers()[1] as AIOpponent;
}

export function startBattle(game: Game, layout: Layout): void {
  if (game.getState() !== GameState.PLACEMENT) throw new Error("The battle has already started");
  const you = humanOf(game);
  you.placeFleet(Board.fromSnapshot({ ships: layout, shots: [] }));
  if (!you.confirmPlacement()) throw new Error("Every ship has to be placed");
  game.beginBattle();
}

/**
 * Your ability, as the server's useAbility applies it. Returns the ship squares a scan found.
 * Throws if refused, possibly leaving the game half changed, so the caller restores it.
 */
export function applyLocalAbility(game: Game, request: AbilityRequest, target?: Square): Coordinate[] {
  if (!target && request.name !== "Double Shot") throw new Error(`${request.name} needs a target`);
  const you = humanOf(game);
  if (you.getOfferedAbility()) you.resolveOffer(true);
  const held = you.getHeldAbility();
  if (!held || held.getName() !== request.name) throw new Error(`You don't hold ${request.name}`);

  if (held instanceof LineScan && request.name === "Line Scan") held.setDirection(request.line === "row");
  if (held instanceof Reroute && request.name === "Reroute") {
    const ship = you.getBoard().getShips().find((s) => s.getName() === request.ship);
    if (!ship) throw new Error(`You have no ${request.ship}`);
    held.selectShip(ship);
    held.setOrientation(request.orientation === "horizontal" ? Orientation.HORIZONTAL : Orientation.VERTICAL);
  }

  const square = target ? Coordinate.fromRowCol(target.row, target.col) : Coordinate.fromRowCol(0, 0);
  game.applyAbility(you, square);
  return held instanceof RadarSweep || held instanceof LineScan ? held.getRevealed() : [];
}

/** Adds scan finds once each, like the server's scan log. */
export function withScanned(scanned: readonly Square[], found: readonly Square[]): Square[] {
  const next = [...scanned];
  for (const f of found) if (!next.some((s) => s.row === f.row && s.col === f.col)) next.push(f);
  return next;
}

function fleetSquares(game: Game): Map<string, Square[]> {
  return new Map(
    computerOf(game)
      .getBoard()
      .getShips()
      .map((s) => [s.getName(), s.getCoordinates().map((c) => c.toRowCol())]),
  );
}

/** One computer action. Like the server, a rerouted ship drops your contacts on its old squares. */
export function computerMove(game: Game, scanned: readonly Square[]): { scanned: Square[]; used: string | null } {
  const computer = computerOf(game);
  const held = computer.getHeldAbility();
  const before = fleetSquares(game);
  computer.takeTurn(game);

  const after = fleetSquares(game);
  const movedFrom = [...before].flatMap(([name, squares]) =>
    JSON.stringify(squares) === JSON.stringify(after.get(name)) ? [] : squares,
  );
  return {
    scanned: scanned.filter((s) => !movedFrom.some((m) => m.row === s.row && m.col === s.col)),
    used: held && computer.getHeldAbility() !== held ? held.getName() : null,
  };
}

/** The server's fireIfTurnExpired. */
export function fireIfExpired(game: Game, now = new Date()): boolean {
  const mover = game.getCurrentTurn();
  if (!mover || !game.isTurnExpired(now)) return false;
  game.fireRandomShot(mover);
  return true;
}

/** Gives back turn time spent away (page hidden or closed), as the server does on reconnect. */
export function resumeAfterAway(game: Game, awaySince: number, now = Date.now()): void {
  const start = game.getTurnStartedAt();
  if (game.getState() !== GameState.IN_PROGRESS || !start) return;
  game.resumeTurnTimer(now - Math.max(awaySince, start.getTime()));
}

/** The game as seat 1's PlayerView, like the server's viewFor. */
export function localView(game: Game, scanned: readonly Square[]): PlayerView {
  const [you, computer] = game.getPlayers();
  const finished = game.getState() === GameState.FINISHED;
  const shotsBy = (p: Player) =>
    game
      .getShots()
      .filter((s) => s.getShooter() === p)
      .map((s) => ({ ...s.getCoordinate().toRowCol(), result: s.getResult(), sunkShipName: s.getSunkShipName() }));
  const seat = (p: Player) => ({ name: p.getName(), ready: p.getIsReady(), connected: true, disconnectedAt: null });
  const winner = game.getWinner();
  const result = finished ? game.resultFor(you) : null;
  const enemyBoard = computer.getBoard();

  return {
    code: "",
    gameType: game.getGameType(),
    lobbyStatus: finished ? LobbyStatus.FINISHED : LobbyStatus.IN_PROGRESS,
    gameState: game.getState(),
    seat: 1,
    you: seat(you),
    opponent: seat(computer),
    yourTurn: !finished && game.getCurrentTurn() === you,
    turnStartedAt: game.getTurnStartedAt()?.toISOString() ?? null,
    doubleShotActive: game.isDoubleShotActive(),
    yourBoard: you.getBoard().toSnapshot(),
    yourShots: shotsBy(you),
    opponentShots: shotsBy(computer),
    heldAbility: you.getHeldAbility()?.getName() ?? null,
    offeredAbility: you.getOfferedAbility()?.getName() ?? null,
    winner: winner === null ? null : winner === you ? 1 : 2,
    endReason: game.getEndReason(),
    opponentBoard: finished ? enemyBoard.toSnapshot() : null,
    revealedSquares: finished
      ? []
      : scanned.filter((s) => !enemyBoard.hasBeenTargeted(Coordinate.fromRowCol(s.row, s.col))),
    rematch: null,
    result: result && {
      won: result.getDidWin(),
      shotsFired: result.getShotsFired(),
      accuracy: result.getAccuracy(),
      shipsSunk: result.getShipsSunk(),
    },
  };
}
