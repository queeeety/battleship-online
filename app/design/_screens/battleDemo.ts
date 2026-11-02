import type { ShipPlacement } from "@/components/game/Board";
import { SHIPS, coordKey, type CellMark, type ShipType } from "@/components/game/data";
import type { ShotLogEntry } from "@/components/game/ShotLog";
import { BOARD_SIZE } from "@/lib/config";
import { CellState, ShotResult } from "@/lib/enums";
import type { FixturePlacement, GameFixture } from "@/fixtures/game.fixture";

/**
 * A playable battle for the /design showcase, started from the game fixture.
 * Pure on purpose (no React, no timers) so it can be unit tested.
 * Same turn rule as Game.fireShot: a hit or sink keeps the turn, a miss passes it.
 */

export const OPPONENT_NAME = "Teddy";

export interface FleetShip {
    readonly type: ShipType;
    readonly x: number;
    readonly y: number;
    readonly length: number;
    readonly horizontal: boolean;
}

export type Side = "you" | "opponent";
export type Phase = "countdown" | Side | "over";

export interface SunkNotice {
    readonly by: Side;
    readonly ship: ShipType;
}

export interface BattleState {
    readonly phase: Phase;
    readonly turn: number;
    readonly ownFleet: ReadonlyArray<FleetShip>;
    // coordinates as Board keys ("E5"), oldest first
    readonly myShots: ReadonlyArray<string>;
    readonly enemyShots: ReadonlyArray<string>;
    readonly log: ReadonlyArray<ShotLogEntry>;
    readonly sunkNotice: SunkNotice | null;
    readonly winner: Side | null;
    readonly scriptIndex: number;
}

export type BattleAction =
    | { readonly type: "start" }
    | { readonly type: "fire"; readonly key: string }
    | { readonly type: "opponentFire" }
    | { readonly type: "dismissNotice" };

// demo only: in a real game the server keeps these hidden. Agrees with the fixture's shots
// (Destroyer sunk at D7-E7, a hit at H3, misses at A1, F6 and J10).
export const ENEMY_FLEET: ReadonlyArray<FleetShip> = [
    { type: "carrier", x: 1, y: 9, length: 5, horizontal: true },
    { type: "battleship", x: 7, y: 1, length: 4, horizontal: false },
    { type: "cruiser", x: 0, y: 2, length: 3, horizontal: false },
    { type: "submarine", x: 2, y: 1, length: 3, horizontal: true },
    { type: "destroyer", x: 3, y: 6, length: 2, horizontal: true }
];

// Teddy's shots in order: a miss, then A9, A10 sinks your Destroyer (Figma "Battle - 33"), then a miss
export const OPPONENT_SCRIPT: ReadonlyArray<string> = ["F4", "A9", "A10", "J1", "B3", "H7", "D9", "G2"];

export function shipTypeOf(name: string): ShipType {
    const type = (Object.keys(SHIPS) as ShipType[]).find((t) => SHIPS[t].name === name);
    if (!type) {
        throw new Error(`Unknown ship name in fixture: ${name}`);
    }
    return type;
}

export function shipCells(ship: FleetShip): ReadonlyArray<string> {
    return Array.from({ length: ship.length }, (_, i) =>
        ship.horizontal ? coordKey(ship.x + i, ship.y) : coordKey(ship.x, ship.y + i)
    );
}

function shipAt(fleet: ReadonlyArray<FleetShip>, key: string): FleetShip | undefined {
    return fleet.find((ship) => shipCells(ship).includes(key));
}

export function isSunk(ship: FleetShip, shots: ReadonlyArray<string>): boolean {
    return shipCells(ship).every((key) => shots.includes(key));
}

export function resultOf(fleet: ReadonlyArray<FleetShip>, shots: ReadonlyArray<string>, key: string): "miss" | "hit" | "sunk" {
    const ship = shipAt(fleet, key);
    if (!ship) {
        return "miss";
    }
    return isSunk(ship, shots) ? "sunk" : "hit";
}

/** Board marks for every shot: a sunk ship's cells all read "sunk". */
export function marksFor(fleet: ReadonlyArray<FleetShip>, shots: ReadonlyArray<string>): Record<string, CellMark> {
    return Object.fromEntries(shots.map((key) => [key, resultOf(fleet, shots, key)]));
}

export function toPlacement(ship: FleetShip, shots: ReadonlyArray<string>): ShipPlacement {
    const hits = shipCells(ship).filter((key) => shots.includes(key)).length;
    const status = hits === 0 ? "intact" : hits === ship.length ? "sunk" : "damaged";
    return { type: ship.type, x: ship.x, y: ship.y, orientation: ship.horizontal ? "horizontal" : "vertical", status };
}

/** The enemy board only shows ships once they are sunk. */
export function revealedEnemyShips(shots: ReadonlyArray<string>): ShipPlacement[] {
    return ENEMY_FLEET.filter((ship) => isSunk(ship, shots)).map((ship) => toPlacement(ship, shots));
}

export function afloatCount(fleet: ReadonlyArray<FleetShip>, shots: ReadonlyArray<string>): number {
    return fleet.filter((ship) => !isSunk(ship, shots)).length;
}

function fleetFrom(placements: ReadonlyArray<FixturePlacement>): ReadonlyArray<FleetShip> {
    return placements.map((p) => ({ type: shipTypeOf(p.name), x: p.x, y: p.y, length: p.length, horizontal: p.horizontal }));
}

// the fixture keeps x,y cells; Board wants "E5" keys
function shotKeysOn(fixture: GameFixture): ReadonlyArray<string> {
    return fixture.ownCells
        .filter((c) => c.state === CellState.HIT || c.state === CellState.MISS)
        .map((c) => coordKey(c.x, c.y));
}

// one log row per fixture shot, yours then theirs for each turn
function fixtureLog(fixture: GameFixture, enemyShots: ReadonlyArray<string>): ShotLogEntry[] {
    const mine = fixture.shots.map((s, i): ShotLogEntry => ({
        turn: i + 1,
        by: "you",
        coord: coordKey(s.x, s.y),
        result: s.result === ShotResult.MISS ? "miss" : s.result === ShotResult.SUNK ? "sunk" : "hit",
        ship: s.shipName ? shipTypeOf(s.shipName) : undefined
    }));
    const theirs = enemyShots.map((coord, i): ShotLogEntry => ({ turn: i + 1, by: "opponent", coord, result: "miss" }));
    return [...mine, ...theirs].sort((a, b) => a.turn - b.turn);
}

export function createBattleState(fixture: GameFixture): BattleState {
    const ownFleet = fleetFrom(fixture.ownShips);
    const enemyShots = shotKeysOn(fixture);
    const log = fixtureLog(fixture, enemyShots).map((e) =>
        e.by === "opponent" && e.coord ? { ...e, result: resultOf(ownFleet, enemyShots, e.coord) } : e
    );
    return {
        phase: "countdown",
        turn: fixture.shots.length + 1,
        ownFleet,
        myShots: fixture.shots.map((s) => coordKey(s.x, s.y)),
        enemyShots,
        log,
        sunkNotice: null,
        winner: null,
        scriptIndex: 0
    };
}

interface ShotOutcome {
    readonly shots: ReadonlyArray<string>;
    readonly result: "miss" | "hit" | "sunk";
    readonly ship?: ShipType;
    readonly fleetGone: boolean;
}

function resolveShot(fleet: ReadonlyArray<FleetShip>, before: ReadonlyArray<string>, key: string): ShotOutcome {
    const shots = [...before, key];
    const result = resultOf(fleet, shots, key);
    return { shots, result, ship: shipAt(fleet, key)?.type, fleetGone: afloatCount(fleet, shots) === 0 };
}

// after a shot: the win check first, then a miss passes the turn (and bumps the turn number)
function afterShot(state: BattleState, by: Side, outcome: ShotOutcome, coord: string): BattleState {
    const other: Side = by === "you" ? "opponent" : "you";
    const passes = outcome.result === "miss" && !outcome.fleetGone;
    const entry: ShotLogEntry = {
        turn: state.turn,
        by,
        coord,
        result: outcome.result,
        ship: outcome.result === "sunk" ? outcome.ship : undefined
    };
    return {
        ...state,
        phase: outcome.fleetGone ? "over" : passes ? other : by,
        turn: passes ? state.turn + 1 : state.turn,
        log: [...state.log, entry],
        sunkNotice: outcome.result === "sunk" && outcome.ship ? { by, ship: outcome.ship } : state.sunkNotice,
        winner: outcome.fleetGone ? by : null
    };
}

function fire(state: BattleState, key: string): BattleState {
    // a repeat or out-of-turn shot is ignored, like Board.receiveShot rejecting it
    if (state.phase !== "you" || state.myShots.includes(key)) {
        return state;
    }
    const outcome = resolveShot(ENEMY_FLEET, state.myShots, key);
    return { ...afterShot(state, "you", outcome, key), myShots: outcome.shots };
}

// scripted target first; once the script runs out, the first square not yet fired at
function nextOpponentTarget(state: BattleState): { key: string; scriptIndex: number } | null {
    const fromScript = OPPONENT_SCRIPT.slice(state.scriptIndex).findIndex((k) => !state.enemyShots.includes(k));
    if (fromScript !== -1) {
        const index = state.scriptIndex + fromScript;
        return { key: OPPONENT_SCRIPT[index], scriptIndex: index + 1 };
    }
    const all = Array.from({ length: BOARD_SIZE * BOARD_SIZE }, (_, i) => coordKey(i % BOARD_SIZE, Math.floor(i / BOARD_SIZE)));
    const key = all.find((k) => !state.enemyShots.includes(k));
    return key ? { key, scriptIndex: OPPONENT_SCRIPT.length } : null;
}

function opponentFire(state: BattleState): BattleState {
    const target = state.phase === "opponent" ? nextOpponentTarget(state) : null;
    if (!target) {
        return state;
    }
    const outcome = resolveShot(state.ownFleet, state.enemyShots, target.key);
    return { ...afterShot(state, "opponent", outcome, target.key), enemyShots: outcome.shots, scriptIndex: target.scriptIndex };
}

export function battleReducer(state: BattleState, action: BattleAction): BattleState {
    switch (action.type) {
        case "start":
            return state.phase === "countdown" ? { ...state, phase: "you" } : state;
        case "fire":
            return fire(state, action.key);
        case "opponentFire":
            return opponentFire(state);
        case "dismissNotice":
            return { ...state, sunkNotice: null };
    }
}
