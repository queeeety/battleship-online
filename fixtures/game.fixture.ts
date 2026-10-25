import type { CellState, JoinError, PlacementError, ShotResult } from "@/lib/enums";

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

export interface GameFixture {
    readonly ownCells: ReadonlyArray<FixtureCell>;
    readonly enemyCells: ReadonlyArray<FixtureCell>;
    readonly shots: ReadonlyArray<FixtureShot>;
    readonly ships: ReadonlyArray<FixtureShip>;
}

export function createGameFixture(): GameFixture {
    throw new Error("not yet");
}

export function listJoinErrors(): ReadonlyArray<JoinError> {
    throw new Error("not yet");
}

export function listPlacementErrors(): ReadonlyArray<PlacementError> {
    throw new Error("not yet");
}
