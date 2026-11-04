import type { ShipPlacement } from "@/components/game/Board";
import { SHIPS, abilityIdFromName, coordKey, type CellMark, type ShipType } from "@/components/game/data";
import type { ShotLogEntry } from "@/components/game/ShotLog";
import { BOARD_SIZE } from "@/lib/config";
import { CellState, ShotResult } from "@/lib/enums";
import type { FixturePlacement, GameFixture } from "@/fixtures/game.fixture";
import type { AbilityRequest } from "@/lib/server/RequestValidator";
import { rerouteFleet, scanFleet } from "./abilityDemo";

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
    // abilities, by the server's names ("Line Scan"), as in PlayerView
    readonly heldAbility: string | null;
    readonly offeredAbility: string | null;
    // ship squares your scans found, as keys
    readonly revealed: ReadonlyArray<string>;
    readonly doubleShotActive: boolean;
}

export type BattleAction =
    | { readonly type: "start" }
    | { readonly type: "fire"; readonly key: string }
    // draw: the ability you'd get if this shot sinks one of your ships (picked by the screen, so this stays pure)
    | { readonly type: "opponentFire"; readonly draw?: string }
    // your turn clock ran out: the screen picks a random open square, like Game.fireRandomShot
    | { readonly type: "timeout"; readonly key: string }
    | { readonly type: "dismissNotice" }
    | { readonly type: "useAbility"; readonly request: AbilityRequest; readonly target?: string }
    // true keeps the held ability, false takes the offer
    | { readonly type: "chooseAbility"; readonly keep: boolean }
    // showcase only: draw as if one of your ships had just sunk
    | { readonly type: "drawAbility"; readonly name: string };

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

/** Every square on the board not yet fired at, row by row. */
export function openSquares(shots: ReadonlyArray<string>): string[] {
    const all = Array.from({ length: BOARD_SIZE * BOARD_SIZE }, (_, i) => coordKey(i % BOARD_SIZE, Math.floor(i / BOARD_SIZE)));
    return all.filter((key) => !shots.includes(key));
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
        scriptIndex: 0,
        // the showcase starts holding one so the card has something to show
        heldAbility: "Line Scan",
        offeredAbility: null,
        revealed: [],
        doubleShotActive: false
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
    const next = { ...afterShot(state, "you", outcome, key), myShots: outcome.shots };
    // Double Shot: a miss doesn't pass the turn, once
    if (state.doubleShotActive && outcome.result === "miss" && !outcome.fleetGone) {
        return { ...next, phase: "you", turn: state.turn, doubleShotActive: false };
    }
    return next;
}

// scripted target first; once the script runs out, the first square not yet fired at
function nextOpponentTarget(state: BattleState): { key: string; scriptIndex: number } | null {
    const fromScript = OPPONENT_SCRIPT.slice(state.scriptIndex).findIndex((k) => !state.enemyShots.includes(k));
    if (fromScript !== -1) {
        const index = state.scriptIndex + fromScript;
        return { key: OPPONENT_SCRIPT[index], scriptIndex: index + 1 };
    }
    const key = openSquares(state.enemyShots)[0];
    return key ? { key, scriptIndex: OPPONENT_SCRIPT.length } : null;
}

function opponentFire(state: BattleState, draw?: string): BattleState {
    const target = state.phase === "opponent" ? nextOpponentTarget(state) : null;
    if (!target) {
        return state;
    }
    const outcome = resolveShot(state.ownFleet, state.enemyShots, target.key);
    const next = { ...afterShot(state, "opponent", outcome, target.key), enemyShots: outcome.shots, scriptIndex: target.scriptIndex };
    // like Game.grantAbility: the ability goes to the player who lost the ship
    return outcome.result === "sunk" && draw && !outcome.fleetGone ? grant(next, draw) : next;
}

// one held at a time: an empty slot takes it, otherwise it's offered as keep-or-replace
function grant(state: BattleState, name: string): BattleState {
    if (!state.heldAbility) return { ...state, heldAbility: name };
    return name === state.heldAbility ? state : { ...state, offeredAbility: name };
}

function abilityEntry(state: BattleState, request: AbilityRequest, coord: string | undefined, note: string): ShotLogEntry {
    return { turn: state.turn, by: "you", ability: abilityIdFromName(request.name) ?? undefined, coord, note };
}

// what the useAbility server action does; a refused request changes nothing, like MoveRefusedError
function applyAbility(state: BattleState, request: AbilityRequest, target: string | undefined): BattleState {
    if (state.phase !== "you" || state.heldAbility !== request.name) return state;
    // using it before answering an offer keeps it, as on the server
    const base = { ...state, offeredAbility: null, heldAbility: null };
    // the turn's shot is used up: the turn passes, as Game.applyAbility's switchTurn
    const passTurn = (s: BattleState): BattleState => ({ ...s, phase: "opponent", turn: s.turn + 1 });

    if (request.name === "Double Shot") {
        if (state.doubleShotActive) return state;
        return { ...base, doubleShotActive: true, log: [...state.log, abilityEntry(state, request, undefined, "fire again")] };
    }
    if (!target) return state;
    if (request.name === "Reroute") {
        const ownFleet = rerouteFleet(request, target, state.ownFleet, state.enemyShots);
        if (!ownFleet) return state;
        return passTurn({ ...base, ownFleet, log: [...state.log, abilityEntry(state, request, undefined, `${request.ship} moved`)] });
    }
    const found = scanFleet(request, target, ENEMY_FLEET, state.myShots);
    if (!found) return state;
    const note = `${found.length} contact${found.length === 1 ? "" : "s"}`;
    return passTurn({
        ...base,
        revealed: [...new Set([...state.revealed, ...found])],
        log: [...state.log, abilityEntry(state, request, target, note)]
    });
}

function chooseAbility(state: BattleState, keep: boolean): BattleState {
    if (!state.offeredAbility) return state;
    return { ...state, heldAbility: keep ? state.heldAbility : state.offeredAbility, offeredAbility: null };
}

export function battleReducer(state: BattleState, action: BattleAction): BattleState {
    switch (action.type) {
        case "start":
            return state.phase === "countdown" ? { ...state, phase: "you" } : state;
        case "fire":
        case "timeout":
            return fire(state, action.key);
        case "opponentFire":
            return opponentFire(state, action.draw);
        case "dismissNotice":
            return { ...state, sunkNotice: null };
        case "useAbility":
            return applyAbility(state, action.request, action.target);
        case "chooseAbility":
            return chooseAbility(state, action.keep);
        case "drawAbility":
            return state.phase === "over" ? state : grant(state, action.name);
    }
}
