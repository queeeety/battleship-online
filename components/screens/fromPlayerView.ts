import type { ShipPlacement } from "@/components/game/Board";
import {
  SHIPS,
  abilityIdFromName,
  coordKey,
  shipTypeFromName,
  type CellMark,
  type EndReasonName,
  type ShipType,
} from "@/components/game/data";
import type { RematchState } from "@/components/game/RematchPanel";
import type { ShotLogEntry } from "@/components/game/ShotLog";
import type { PlayerView, ShotView } from "@/lib/controllers/Server";
import type { BoardSnapshot } from "@/lib/entities/board";
import { FLEET_SIZE } from "@/lib/entities/ships/fleet";
import { EndReason, RematchStatus, ShotResult } from "@/lib/enums";
import { squareKeys } from "./placement";

export interface BoardState {
  ships: ShipPlacement[];
  marks: Record<string, CellMark>;
  lastShot?: string;
  afloat: number;
  total: number;
}

export function boardProps({ afloat, total, marks, ships }: BoardState) {
  return { meta: `${afloat} of ${total} afloat`, marks, ships };
}

export interface SunkNotice {
  by: "you" | "opponent";
  ship: ShipType;
}

const MARK: Record<ShotResult, "miss" | "hit" | "sunk"> = {
  [ShotResult.MISS]: "miss",
  [ShotResult.HIT]: "hit",
  [ShotResult.SUNK]: "sunk",
};

function shotKey(s: { row: number; col: number }): string {
  return coordKey(s.col, s.row);
}

// a fleet and the shots fired at it; every square of a sunk ship reads "sunk"
function fleetBoard(fleet: BoardSnapshot["ships"], shots: readonly ShotView[]): BoardState {
  const marks: Record<string, CellMark> = {};
  for (const s of shots) marks[shotKey(s)] = MARK[s.result];
  const hit = new Set(shots.filter((s) => s.result !== ShotResult.MISS).map(shotKey));

  const ships = fleet.map((s): ShipPlacement => {
    const type = shipTypeFromName(s.name)!;
    const squares = squareKeys(type, s.col, s.row, s.orientation);
    const hits = squares.filter((key) => hit.has(key)).length;
    const status = hits === 0 ? "intact" : hits === squares.length ? "sunk" : "damaged";
    if (status === "sunk") for (const key of squares) marks[key] = "sunk";
    return { type, x: s.col, y: s.row, orientation: s.orientation, status };
  });

  const last = shots.at(-1);
  return {
    ships,
    marks,
    lastShot: last && shotKey(last),
    afloat: ships.filter((s) => s.status !== "sunk").length,
    total: ships.length,
  };
}

export function ownBoardState(view: PlayerView): BoardState {
  return fleetBoard(view.yourBoard.ships, view.opponentShots);
}

// once the game is over: the ships you sank drawn in place, the rest hidden (as in the design)
export function finalEnemyBoardState(view: PlayerView): BoardState {
  if (!view.opponentBoard) return targetBoardState(view);
  const board = fleetBoard(view.opponentBoard.ships, view.yourShots);
  return { ...board, ships: board.ships.filter((s) => s.status === "sunk"), lastShot: undefined };
}

export function rematchState(view: PlayerView): RematchState {
  if (!view.rematch) return "none";
  switch (view.rematch.status) {
    case RematchStatus.REQUESTED:
      return view.rematch.by === view.seat ? "requested-by-you" : "requested-by-opponent";
    case RematchStatus.ACCEPTED:
      return "accepted";
    case RematchStatus.DECLINED:
      return "declined";
    default:
      return "none";
  }
}

export function resultSummary(view: PlayerView): {
  didWin: boolean;
  reason: EndReasonName;
  shotsFired: number;
  accuracy: number;
  shipsSunk: number;
} | null {
  if (!view.result || view.endReason === null) return null;
  return {
    didWin: view.result.won,
    reason: EndReason[view.endReason] as EndReasonName,
    shotsFired: view.result.shotsFired,
    accuracy: view.result.accuracy,
    shipsSunk: view.result.shipsSunk,
  };
}

// the ships you've sunk are drawn in place; the rest stay hidden
export function targetBoardState(view: PlayerView): BoardState {
  const board = fleetBoard(view.opponentSunkShips, view.yourShots);
  return { ...board, afloat: FLEET_SIZE - board.ships.filter((s) => s.status === "sunk").length, total: FLEET_SIZE };
}

// a refetch sends every shot again, so new ones are found by square, not by count
function newShots(before: readonly ShotView[], after: readonly ShotView[]): ShotView[] {
  const seen = new Set(before.map(shotKey));
  return after.filter((s) => !seen.has(shotKey(s)));
}

function entryFor(shot: ShotView, by: "you" | "opponent"): Omit<ShotLogEntry, "turn"> {
  const ship = shot.sunkShipName ? (shipTypeFromName(shot.sunkShipName) ?? undefined) : undefined;
  return { by, coord: shotKey(shot), result: MARK[shot.result], ship };
}

// the view has no shot times, so only shots that arrive while the page is open can be ordered
export function newLogEntries(before: PlayerView, after: PlayerView, from: number): ShotLogEntry[] {
  const fresh = [
    ...newShots(before.yourShots, after.yourShots).map((s) => entryFor(s, "you")),
    ...newShots(before.opponentShots, after.opponentShots).map((s) => entryFor(s, "opponent")),
  ];
  return fresh.map((e, i) => ({ ...e, turn: from + i + 1 }));
}

export function sunkNotice(before: PlayerView, after: PlayerView): SunkNotice | null {
  const sinks = [
    ...newShots(before.yourShots, after.yourShots).map((s) => ({ s, by: "you" as const })),
    ...newShots(before.opponentShots, after.opponentShots).map((s) => ({ s, by: "opponent" as const })),
  ].filter(({ s }) => s.result === ShotResult.SUNK && s.sunkShipName);
  const last = sinks.at(-1);
  const ship = last && shipTypeFromName(last.s.sunkShipName!);
  return last && ship ? { by: last.by, ship } : null;
}

export function abilityLogEntry(
  by: "you" | "opponent",
  abilityName: string,
  turn: number,
  target?: { row: number; col: number },
): ShotLogEntry {
  // Radar Sweep is sent with its area's top left but aimed by the middle, so the log shows that
  const at = target && abilityName === "Radar Sweep" ? { row: target.row + 1, col: target.col + 1 } : target;
  return {
    turn,
    by,
    ability: abilityIdFromName(abilityName) ?? undefined,
    coord: at && shotKey(at),
    note: "used",
  };
}

export function shipName(type: ShipType): string {
  return SHIPS[type].name;
}
