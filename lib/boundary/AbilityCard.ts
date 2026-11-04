import { DoubleShot, LineScan, RadarSweep, Reroute } from "../abilities";
import type { Ability } from "../abilities";
import { Coordinate } from "../entities/board";
import type { Board } from "../entities/board";
import { Ship } from "../entities/ships";
import { Orientation } from "../enums";
import type { AbilityRequest } from "../server/RequestValidator";

/** Which board an armed ability is aimed at. */
export type AbilityBoard = "own" | "target";

/** What targeting would cover from one square, and whether the server would accept it. */
export interface TargetPreview
{
    squares: Coordinate[];
    valid: boolean;
}

/**
 * Shows the ability you hold, the keep-or-replace prompt and targeting mode.
 * Holds the client's targeting choices: Line Scan's row or column, and Reroute's ship and
 * orientation. It checks targets with the ability's own rules, so the client and the
 * server agree, but the server still decides.
 */
export class AbilityCard
{
    private ability: Ability | null;
    private armed: boolean;
    private offer: { current: Ability; drawn: Ability } | null;
    private lineIsRow: boolean;
    private rerouteShip: Ship | null;
    private rerouteOrientation: Orientation;

    constructor()
    {
        this.ability = null;
        this.armed = false;
        this.offer = null;
        this.lineIsRow = true;
        this.rerouteShip = null;
        this.rerouteOrientation = Orientation.HORIZONTAL;
    }

    // a new ability (or none) drops any targeting in progress
    public show(a: Ability | null): void
    {
        this.ability = a;
        this.cancel();
    }

    public showKeepOrReplace(current: Ability, drawn: Ability): void { this.offer = { current, drawn }; }

    // true keeps the held ability, false takes the drawn one; returns the answer for the server
    public answerOffer(keep: boolean): boolean
    {
        if (this.offer && !keep) this.show(this.offer.drawn);
        this.offer = null;
        return keep;
    }

    /**
     * "armed": pick a target next. "fire-now": the ability needs no target (Double Shot),
     * so send it straight away.
     */
    public arm(): "armed" | "fire-now"
    {
        if (!this.ability) throw new Error("No ability to arm");
        if (!this.needsTarget()) return "fire-now";
        this.armed = true;
        return "armed";
    }

    public cancel(): void
    {
        this.armed = false;
        this.lineIsRow = true;
        this.rerouteShip = null;
        this.rerouteOrientation = Orientation.HORIZONTAL;
    }

    public needsTarget(): boolean { return this.ability !== null && !(this.ability instanceof DoubleShot); }

    // Reroute moves one of your own ships, the rest look at the enemy's waters
    public targetBoard(): AbilityBoard { return this.ability instanceof Reroute ? "own" : "target"; }

    // Line Scan: row or column. Reroute: horizontal or vertical. Nothing for the others.
    public rotate(): void
    {
        if (this.ability instanceof LineScan) this.lineIsRow = !this.lineIsRow;
        if (this.ability instanceof Reroute)
        {
            this.rerouteOrientation = this.rerouteOrientation === Orientation.HORIZONTAL ? Orientation.VERTICAL : Orientation.HORIZONTAL;
        }
    }

    // Reroute only: the ship to move. A ship that can't move anywhere isn't selected.
    public selectShip(board: Board, ship: Ship | null): boolean
    {
        if (!(this.ability instanceof Reroute)) return false;
        if (ship && !this.ability.canMove(board, ship)) return false;
        this.rerouteShip = ship;
        // start in whichever orientation has somewhere to go, the ship's own if it can
        if (ship)
        {
            const own = ship.getOrientation();
            this.rerouteOrientation = this.ability.validPositions(board, ship, own).length > 0 ? own
                : own === Orientation.HORIZONTAL ? Orientation.VERTICAL : Orientation.HORIZONTAL;
        }
        return true;
    }

    /**
     * The squares an armed ability would cover from t, for the board's highlight.
     * Radar Sweep: the 3x3 area with t at the top left. Line Scan: t's row or column.
     * Reroute: where the selected ship would sit with its start on t.
     * null when there's nothing to show (not armed, Double Shot, or no ship selected yet).
     */
    public previewAt(board: Board, t: Coordinate): TargetPreview | null
    {
        if (!this.armed || !this.ability) return null;
        const onBoard = (sq: Coordinate) => sq.isWithinBounds(board.getWidth(), board.getHeight());

        if (this.ability instanceof RadarSweep)
        {
            return { squares: RadarSweep.areaFrom(t).filter(onBoard), valid: this.isValidTarget(board, t) };
        }
        if (this.ability instanceof LineScan)
        {
            this.ability.setDirection(this.lineIsRow);
            return { squares: this.ability.lineThrough(board, t), valid: this.isValidTarget(board, t) };
        }
        if (this.ability instanceof Reroute && this.rerouteShip)
        {
            const squares = Ship.squaresFrom(t, this.rerouteOrientation, this.rerouteShip.getLength()).filter(onBoard);
            return { squares, valid: this.isValidTarget(board, t) };
        }
        return null;
    }

    // the ability's own rule, with this card's choices applied first
    public isValidTarget(board: Board, t: Coordinate): boolean
    {
        if (!this.armed || !this.ability) return false;
        if (!t.isWithinBounds(board.getWidth(), board.getHeight())) return false;
        if (this.ability instanceof LineScan) this.ability.setDirection(this.lineIsRow);
        if (this.ability instanceof Reroute)
        {
            if (!this.rerouteShip) return false;
            this.ability.selectShip(this.rerouteShip);
            this.ability.setOrientation(this.rerouteOrientation);
        }
        return this.ability.isValidTarget(board, t);
    }

    // the request body for the useAbility server action
    public toRequest(): AbilityRequest
    {
        const a = this.ability;
        if (a instanceof DoubleShot) return { name: "Double Shot" };
        if (a instanceof RadarSweep) return { name: "Radar Sweep" };
        if (a instanceof LineScan) return { name: "Line Scan", line: this.lineIsRow ? "row" : "column" };
        if (a instanceof Reroute)
        {
            if (!this.rerouteShip) throw new Error("Pick a ship to reroute first");
            return {
                name: "Reroute",
                ship: this.rerouteShip.getName(),
                orientation: this.rerouteOrientation === Orientation.HORIZONTAL ? "horizontal" : "vertical"
            };
        }
        throw new Error("No ability to use");
    }

    public getAbility(): Ability | null { return this.ability; }

    public getOffer(): { current: Ability; drawn: Ability } | null { return this.offer; }

    public isArmed(): boolean { return this.armed; }

    public isLineRow(): boolean { return this.lineIsRow; }

    public getSelectedShip(): Ship | null { return this.rerouteShip; }

    public getRerouteOrientation(): Orientation { return this.rerouteOrientation; }
}

// the scanned squares, for marking the empty ones "clear" once a scan comes back
export function scannedSquares(request: AbilityRequest, board: Board, t: Coordinate): Coordinate[]
{
    const onBoard = (sq: Coordinate) => sq.isWithinBounds(board.getWidth(), board.getHeight());
    if (request.name === "Radar Sweep") return RadarSweep.areaFrom(t).filter(onBoard);
    if (request.name === "Line Scan")
    {
        const scan = new LineScan();
        scan.setDirection(request.line === "row");
        return scan.lineThrough(board, t);
    }
    return [];
}
