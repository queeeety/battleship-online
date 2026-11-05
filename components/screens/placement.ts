import type { ShipPlacement } from "@/components/game/Board";
import { SHIPS, coordKey, shipTypeFromName, type ShipType } from "@/components/game/data";
import { BOARD_SIZE } from "@/lib/config";
import { Board, Coordinate, type BoardSnapshot } from "@/lib/entities/board";
import { Ship, createStandardFleet } from "@/lib/entities/ships";
import { Orientation, PlacementError } from "@/lib/enums";

// checks run on lib's Board, so the rules are the server's
export type Layout = BoardSnapshot["ships"];
export type Heading = "horizontal" | "vertical";

export const FLEET_ORDER: ShipType[] = createStandardFleet().map((s) => shipTypeFromName(s.getName())!);

function boardOf(layout: Layout): Board {
  return Board.fromSnapshot({ ships: layout, shots: [] });
}

function orientationOf(heading: Heading): Orientation {
  return heading === "horizontal" ? Orientation.HORIZONTAL : Orientation.VERTICAL;
}

function squares(type: ShipType, x: number, y: number, heading: Heading): Coordinate[] {
  return Ship.squaresFrom(new Coordinate(x, y), orientationOf(heading), SHIPS[type].length);
}

/** The squares a ship would cover, as Board keys ("E5"); squares off the board are left out. */
export function squareKeys(type: ShipType, x: number, y: number, heading: Heading): string[] {
  return squares(type, x, y, heading)
    .filter((c) => c.isWithinBounds(BOARD_SIZE, BOARD_SIZE))
    .map((c) => coordKey(c.getX(), c.getY()));
}

/** Moves a start square back just far enough that the whole ship fits on the board. */
export function clampStart(type: ShipType, x: number, y: number, heading: Heading): { x: number; y: number } {
  const span = SHIPS[type].length - 1;
  return {
    x: Math.max(0, Math.min(x, BOARD_SIZE - 1 - (heading === "horizontal" ? span : 0))),
    y: Math.max(0, Math.min(y, BOARD_SIZE - 1 - (heading === "vertical" ? span : 0))),
  };
}

export function isPlaced(layout: Layout, type: ShipType): boolean {
  return layout.some((s) => s.name === SHIPS[type].name);
}

/** Why the ship can't go there, or null if it can. */
export function placementError(layout: Layout, type: ShipType, x: number, y: number, heading: Heading): PlacementError | null {
  if (isPlaced(layout, type)) return PlacementError.ALREADY_PLACED;
  const covered = squares(type, x, y, heading);
  if (!covered.every((c) => c.isWithinBounds(BOARD_SIZE, BOARD_SIZE))) return PlacementError.OUT_OF_BOUNDS;
  const board = boardOf(layout);
  if (covered.some((c) => board.getCell(c).getShip() !== null)) return PlacementError.OVERLAPS_SHIP;
  return null;
}

/** The layout with the ship added; check placementError first. */
export function placeShip(layout: Layout, type: ShipType, x: number, y: number, heading: Heading): Layout {
  return [...layout, { name: SHIPS[type].name, row: y, col: x, orientation: heading }];
}

export function removeShip(layout: Layout, type: ShipType): Layout {
  return layout.filter((s) => s.name !== SHIPS[type].name);
}

export function shipAt(layout: Layout, x: number, y: number): { type: ShipType; heading: Heading } | null {
  const ship = boardOf(layout).getCell(new Coordinate(x, y)).getShip();
  if (!ship) return null;
  const placed = layout.find((s) => s.name === ship.getName())!;
  return { type: shipTypeFromName(placed.name)!, heading: placed.orientation };
}

export function randomLayout(): Layout {
  const board = new Board();
  board.placeFleetRandomly();
  return board.toSnapshot().ships;
}

export function isComplete(layout: Layout): boolean {
  return boardOf(layout).isFleetComplete();
}

/** For the Board component: x is the column and y the row. */
export function toShipPlacements(layout: Layout): ShipPlacement[] {
  return layout.map((s) => ({ type: shipTypeFromName(s.name)!, x: s.col, y: s.row, orientation: s.orientation }));
}

/** The Ready button: "Ready · 2 ships left", then just "Ready". */
export function readyLabel(left: number): string {
  if (left === 0) return "Ready";
  return `Ready · ${left} ${left === 1 ? "ship" : "ships"} left`;
}

export function placementErrorText(error: PlacementError, type: ShipType): string {
  const name = SHIPS[type].name;
  switch (error) {
    case PlacementError.OUT_OF_BOUNDS:
      return `${name} doesn't fit there.`;
    case PlacementError.OVERLAPS_SHIP:
      return `${name} overlaps another ship.`;
    case PlacementError.ALREADY_PLACED:
      return `${name} is already on the board.`;
    case PlacementError.FLEET_INCOMPLETE:
      return "Place every ship before you confirm.";
  }
}
