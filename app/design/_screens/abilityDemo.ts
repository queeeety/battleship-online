import { SHIPS, coordKey, parseCoordKey } from "@/components/game/data";
import { LineScan, RadarSweep } from "@/lib/abilities";
import { ABILITY_FACTORIES } from "@/lib/abilities/registry";
import { Board, Coordinate, type BoardSnapshot } from "@/lib/entities/board";
import { Orientation } from "@/lib/enums";
import type { AbilityRequest } from "@/lib/server/RequestValidator";
import type { FleetShip } from "./battleDemo";

/**
 * Abilities for the /design battle, resolved with the real Board and ability classes,
 * so the showcase follows the same rules as the server's useAbility.
 */

type Square = { row: number; col: number };

function coordinateOf(key: string): Coordinate | null {
  const c = parseCoordKey(key);
  return c ? new Coordinate(c.x, c.y) : null;
}

/** Board squares from "E5"-style keys. */
export function squaresOf(keys: ReadonlyArray<string>): Square[] {
  return keys.flatMap((key) => {
    const c = parseCoordKey(key);
    return c ? [{ row: c.y, col: c.x }] : [];
  });
}

/** A fleet and the shots fired at it, as the server would send it in PlayerView.yourBoard. */
export function boardSnapshot(fleet: ReadonlyArray<FleetShip>, shots: ReadonlyArray<string>): BoardSnapshot {
  return {
    ships: fleet.map((s) => ({
      name: SHIPS[s.type].name,
      row: s.y,
      col: s.x,
      orientation: s.horizontal ? "horizontal" : "vertical",
    })),
    shots: squaresOf(shots),
  };
}

/** Keys of the unshot ship squares a scan finds; null if the server would refuse the target. */
export function scanFleet(
  request: AbilityRequest,
  targetKey: string,
  fleet: ReadonlyArray<FleetShip>,
  shots: ReadonlyArray<string>,
): string[] | null {
  const t = coordinateOf(targetKey);
  if (!t || (request.name !== "Radar Sweep" && request.name !== "Line Scan")) return null;
  const board = Board.fromSnapshot(boardSnapshot(fleet, shots));

  let found: Coordinate[];
  if (request.name === "Radar Sweep") {
    if (!new RadarSweep().isValidTarget(board, t)) return null;
    found = board.scanArea(t, 3);
  } else {
    const scan = new LineScan();
    scan.setDirection(request.line === "row");
    if (!scan.isValidTarget(board, t)) return null;
    found = board.scanLine(request.line === "row" ? t.getY() : t.getX(), request.line === "row");
  }
  return found.map((c) => coordKey(c.getX(), c.getY()));
}

/** The fleet after Reroute moves one ship so it starts on targetKey; null if the move isn't allowed. */
export function rerouteFleet(
  request: AbilityRequest,
  targetKey: string,
  fleet: ReadonlyArray<FleetShip>,
  shots: ReadonlyArray<string>,
): FleetShip[] | null {
  const t = coordinateOf(targetKey);
  if (!t || request.name !== "Reroute") return null;
  const board = Board.fromSnapshot(boardSnapshot(fleet, shots));
  const ship = board.getShips().find((s) => s.getName() === request.ship);
  const o = request.orientation === "horizontal" ? Orientation.HORIZONTAL : Orientation.VERTICAL;
  if (!ship || !board.moveShip(ship, t, o)) return null;
  return fleet.map((s) =>
    SHIPS[s.type].name === request.ship ? { ...s, x: t.getX(), y: t.getY(), horizontal: o === Orientation.HORIZONTAL } : s,
  );
}

/** A random ability name other than the one given, like Game.grantAbility's redraw. */
export function randomAbilityName(not: string | null): string {
  const names = ABILITY_FACTORIES.map((make) => make().getName()).filter((n) => n !== not);
  return names[Math.floor(Math.random() * names.length)];
}
