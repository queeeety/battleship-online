import type { Ability } from "@/lib/abilities/Ability";
import { DoubleShot } from "@/lib/abilities/DoubleShot";
import { LineScan } from "@/lib/abilities/LineScan";
import { RadarSweep } from "@/lib/abilities/RadarSweep";
import { Reroute } from "@/lib/abilities/Reroute";
import type { Ship } from "@/lib/entities/ships/Ship";
import { Battleship } from "@/lib/entities/ships/Battleship";
import { Carrier } from "@/lib/entities/ships/Carrier";
import { Cruiser } from "@/lib/entities/ships/Cruiser";
import { Destroyer } from "@/lib/entities/ships/Destroyer";
import { Submarine } from "@/lib/entities/ships/Submarine";
import type { EndReason } from "@/lib/enums";

export type ShipType = "carrier" | "battleship" | "cruiser" | "submarine" | "destroyer";
export type AbilityId = "radar-sweep" | "line-scan" | "double-shot" | "reroute";
export type CellMark = "miss" | "hit" | "sunk" | "contact" | "clear";
/** The EndReason enum's member names, e.g. "FLEET_DESTROYED". */
export type EndReasonName = keyof typeof EndReason;

function shipInfo(ship: Ship) {
  return { name: ship.getName(), length: ship.getLength() };
}

// names and lengths come from the ship classes in lib/
export const SHIPS: Record<ShipType, { name: string; length: number }> = {
  carrier: shipInfo(new Carrier()),
  battleship: shipInfo(new Battleship()),
  cruiser: shipInfo(new Cruiser()),
  submarine: shipInfo(new Submarine()),
  destroyer: shipInfo(new Destroyer()),
};

function abilityInfo(ability: Ability, description: string) {
  return { name: ability.getName(), usesTurnShot: ability.getUsesTurnShot(), description };
}

// names and turn cost come from the ability classes in lib/; the descriptions are UI copy
export const ABILITIES: Record<AbilityId, { name: string; description: string; usesTurnShot: boolean }> = {
  "radar-sweep": abilityInfo(new RadarSweep(), "Scan a square area. Cells with a ship show a contact."),
  "line-scan": abilityInfo(new LineScan(), "Scan one full row or column for ships."),
  "double-shot": abilityInfo(new DoubleShot(), "Fire a second shot this turn."),
  reroute: abilityInfo(new Reroute(), "Move one undamaged ship to a new valid position."),
};

/** "E5" from zero-based x (column) and y (row). */
export function coordKey(x: number, y: number): string {
  return String.fromCharCode(65 + x) + (y + 1);
}

/** Zero-based x and y from "E5"; null if it isn't a square key. */
export function parseCoordKey(key: string): { x: number; y: number } | null {
  const match = /^([A-Z])(\d{1,2})$/.exec(key);
  if (!match) return null;
  return { x: match[1].charCodeAt(0) - 65, y: Number(match[2]) - 1 };
}

function idFromName<Id extends string>(table: Record<Id, { name: string }>, name: string | null): Id | null {
  if (name === null) return null;
  return (Object.keys(table) as Id[]).find((id) => table[id].name === name) ?? null;
}

/** "radar-sweep" from the server's "Radar Sweep"; null for none or an unknown name. */
export function abilityIdFromName(name: string | null): AbilityId | null {
  return idFromName(ABILITIES, name);
}

/** "carrier" from the ship class name "Carrier". */
export function shipTypeFromName(name: string): ShipType | null {
  return idFromName(SHIPS, name);
}
