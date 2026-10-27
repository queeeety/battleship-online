import type { Ship } from "./Ship";
import { Carrier } from "./Carrier";
import { Battleship } from "./Battleship";
import { Cruiser } from "./Cruiser";
import { Submarine } from "./Submarine";
import { Destroyer } from "./Destroyer";

/**
 * The ships every player starts with.
 * To add a ship type, make a Ship subclass and add it to this list.
 */
const STANDARD_FLEET: ReadonlyArray<() => Ship> = [
    () => new Carrier(),
    () => new Battleship(),
    () => new Cruiser(),
    () => new Submarine(),
    () => new Destroyer()
];

export const FLEET_SIZE = STANDARD_FLEET.length;

export function createStandardFleet(): Ship[] { return STANDARD_FLEET.map(make => make()); }
