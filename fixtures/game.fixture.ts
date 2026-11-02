import { BOARD_SIZE } from "@/lib/config";
import { CellState, JoinError, PlacementError, ShotResult } from "@/lib/enums";

/**
 * Hand-written data to build the UI against before the real Game exists.
 * Plain types on purpose: the entity classes have private fields and no state yet.
 */

export interface FixtureCell {
    readonly x: number;
    readonly y: number;
    readonly state: CellState;
    readonly scanned: boolean;
}

export interface FixtureShot {
    readonly x: number;
    readonly y: number;
    readonly result: ShotResult;
    readonly shipName?: string;
}

export interface FixtureShip {
    readonly name: string;
    readonly length: number;
    readonly sunk: boolean;
}

export interface FixturePlacement {
    readonly name: string;
    readonly x: number;
    readonly y: number;
    readonly length: number;
    readonly horizontal: boolean;
}

export interface GameFixture {
    readonly ownCells: ReadonlyArray<FixtureCell>;
    readonly ownShips: ReadonlyArray<FixturePlacement>;
    readonly enemyCells: ReadonlyArray<FixtureCell>;
    readonly shots: ReadonlyArray<FixtureShot>;
    readonly ships: ReadonlyArray<FixtureShip>;
}

// my fleet, same names and lengths as lib/entities/ships
const OWN_PLACEMENTS: ReadonlyArray<FixturePlacement> = [
    { name: "Carrier", x: 0, y: 0, length: 5, horizontal: true },
    { name: "Battleship", x: 9, y: 2, length: 4, horizontal: false },
    { name: "Cruiser", x: 2, y: 4, length: 3, horizontal: true },
    { name: "Submarine", x: 5, y: 7, length: 3, horizontal: true },
    { name: "Destroyer", x: 0, y: 8, length: 2, horizontal: false }
];

// what the enemy fired at me: one hit on my Carrier, two misses
const SHOTS_AGAINST_ME: ReadonlyArray<FixtureShot> = [
    { x: 2, y: 0, result: ShotResult.HIT },
    { x: 5, y: 5, result: ShotResult.MISS },
    { x: 8, y: 1, result: ShotResult.MISS }
];

// my shots at the enemy: Destroyer sunk, a hit on something else, some misses
const MY_SHOTS: ReadonlyArray<FixtureShot> = [
    { x: 0, y: 0, result: ShotResult.MISS },
    { x: 3, y: 6, result: ShotResult.HIT },
    { x: 4, y: 6, result: ShotResult.SUNK, shipName: "Destroyer" },
    { x: 7, y: 2, result: ShotResult.HIT },
    { x: 5, y: 5, result: ShotResult.MISS },
    { x: 9, y: 9, result: ShotResult.MISS }
];

// cells a scan ability lit up around the hit at (7,2)
const SCANNED: ReadonlyArray<readonly [number, number]> = [[6, 2], [8, 2], [7, 3]];

// the enemy fleet as the player sees it: only which ships are sunk
const ENEMY_SHIPS: ReadonlyArray<FixtureShip> = [
    { name: "Carrier", length: 5, sunk: false },
    { name: "Battleship", length: 4, sunk: false },
    { name: "Cruiser", length: 3, sunk: false },
    { name: "Submarine", length: 3, sunk: false },
    { name: "Destroyer", length: 2, sunk: true }
];

const cellKey = (x: number, y: number): string => `${x},${y}`;

function shotToState(shot: FixtureShot): readonly [string, CellState] {
    const state = shot.result === ShotResult.MISS ? CellState.MISS : CellState.HIT;
    return [cellKey(shot.x, shot.y), state];
}

function placementCells(p: FixturePlacement): ReadonlyArray<readonly [string, CellState]> {
    return Array.from({ length: p.length }, (_, i) => {
        const x = p.horizontal ? p.x + i : p.x;
        const y = p.horizontal ? p.y : p.y + i;
        return [cellKey(x, y), CellState.OCCUPIED] as const;
    });
}

// full BOARD_SIZE x BOARD_SIZE grid, row by row, EMPTY unless listed
function buildCells(
    states: ReadonlyMap<string, CellState>,
    scanned: ReadonlySet<string> = new Set()
): ReadonlyArray<FixtureCell> {
    return Array.from({ length: BOARD_SIZE * BOARD_SIZE }, (_, i) => {
        const x = i % BOARD_SIZE;
        const y = Math.floor(i / BOARD_SIZE);
        const k = cellKey(x, y);
        return { x, y, state: states.get(k) ?? CellState.EMPTY, scanned: scanned.has(k) };
    });
}

// numeric enums also hold their names as keys, keep only the numbers
function enumValues<T extends number>(e: Record<string, string | number>): ReadonlyArray<T> {
    return Object.values(e).filter((v): v is T => typeof v === "number");
}

/**
 * A mid-game snapshot: my board shows my ships plus enemy shots,
 * the enemy board shows only my shots (no ship positions, the server keeps those).
 */
export function createGameFixture(): GameFixture {
    // later entries win, so shots overwrite OCCUPIED
    const ownStates = new Map([
        ...OWN_PLACEMENTS.flatMap(placementCells),
        ...SHOTS_AGAINST_ME.map(shotToState)
    ]);
    const enemyStates = new Map(MY_SHOTS.map(shotToState));
    const scanned = new Set(SCANNED.map(([x, y]) => cellKey(x, y)));

    return {
        ownCells: buildCells(ownStates),
        ownShips: OWN_PLACEMENTS,
        enemyCells: buildCells(enemyStates, scanned),
        shots: MY_SHOTS,
        ships: ENEMY_SHIPS
    };
}

export function listJoinErrors(): ReadonlyArray<JoinError> {
    return enumValues<JoinError>(JoinError);
}

export function listPlacementErrors(): ReadonlyArray<PlacementError> {
    return enumValues<PlacementError>(PlacementError);
}
