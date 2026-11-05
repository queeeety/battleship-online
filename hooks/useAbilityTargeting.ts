"use client";

import {
    useEffect,
    useEffectEvent,
    useMemo,
    useReducer,
    useRef,
    useState,
    type HTMLAttributes,
    type PointerEvent as ReactPointerEvent,
    type Ref
} from "react";
import type { BoardProps, ShipPlacement } from "@/components/game/Board";
import {
    abilityIdFromName,
    coordKey,
    shipTypeFromName,
    type AbilityId,
    type CellMark,
    type ShipType
} from "@/components/game/data";
import { clampStart, haloKeys, squareKeys, turnAbout, type Heading } from "@/components/screens/placement";
import { DoubleShot, LineScan, RadarSweep, Reroute } from "@/lib/abilities";
import { createAbility } from "@/lib/abilities/registry";
import { AbilityCard, scannedSquares, type AbilityBoard } from "@/lib/boundary/AbilityCard";
import { Board, Coordinate, type BoardSnapshot } from "@/lib/entities/board";
import type { Ship } from "@/lib/entities/ships";
import { Orientation } from "@/lib/enums";
import type { AbilityRequest } from "@/lib/server/RequestValidator";

type Square = { row: number; col: number };
type Cell = { x: number; y: number; key: string };

export interface AbilityTargetingInput {
    /** The server's names, e.g. "Radar Sweep", as in PlayerView. */
    heldAbility: string | null;
    offeredAbility: string | null;
    yourTurn: boolean;
    doubleShotActive: boolean;
    /** Your fleet and the shots fired at it (PlayerView.yourBoard). */
    yourBoard: BoardSnapshot;
    /** Your shots at the enemy (PlayerView.yourShots). */
    yourShots: Square[];
    /** Ship squares your scans found and nobody has shot yet (PlayerView.revealedSquares). */
    revealedSquares: Square[];
    /** Change it to forget the empty scan marks, e.g. after the opponent's Reroute. */
    scanReset?: unknown;
    /** Sends the ability; resolve true once the server took it (useAbility's ok). */
    onUse: (request: AbilityRequest, target?: Square) => Promise<boolean> | boolean;
    /** Answers the keep-or-replace prompt (chooseAbility); resolve false if it failed and the prompt comes back. */
    onChoose: (keep: boolean) => unknown;
}

export interface AbilityTargeting {
    /** Props for <AbilityCard>. */
    card: {
        ability: AbilityId | null;
        state: "ready" | "armed" | "unavailable";
        onUse: () => void;
        onCancel: () => void;
        /** While armed: Rotate switches Line Scan between row and column, or turns the rerouted ship (R does the same). */
        turn?: { label: string; onTurn: () => void };
        /** Reroute: sends the move dragged or turned into place. */
        confirm?: { label: string; onConfirm: () => void };
    };
    /** One line on what to do next, or why the ability can't be used. Show it in a live region. */
    hint: string | null;
    /** Props for <AbilityDraw> inside a Dialog; null when there's nothing to answer. */
    offer: { current: AbilityId; drawn: AbilityId; onKeep: () => void; onReplace: () => void } | null;
    /** contact and clear marks from your scans. Spread your shot marks after these so they win. */
    scanMarks: Record<string, CellMark>;
    /** Spread onto the enemy board after its own props: takes over clicks while a scan is armed. */
    targetBoardProps: Partial<BoardProps>;
    /** Spread onto your own board: takes clicks while Reroute is armed. */
    ownBoardProps: Partial<BoardProps>;
    /** The rerouted ship's ghost at the hovered square, to add to your own board's ships. */
    ownGhost: ShipPlacement[];
    /** Spread onto the area around your own board: Reroute's dragging starts here. */
    ownArea: HTMLAttributes<HTMLDivElement> & { ref: Ref<HTMLDivElement> };
}

// a board snapshot as a stable string, so a fresh-but-equal prop doesn't rebuild the Board
function useBoard(snapshot: BoardSnapshot): Board
{
    const key = JSON.stringify(snapshot);
    return useMemo(() => Board.fromSnapshot(JSON.parse(key) as BoardSnapshot), [key]);
}

const keyOf = (c: Coordinate) => coordKey(c.getX(), c.getY());

// Radar Sweep's area is 3×3; it's aimed by its middle square
const RADAR_SPAN = 3;

// a press that moves less than this is a tap
const DRAG_THRESHOLD_PX = 6;

type Point = { x: number; y: number };

// Reroute by pointer: a ship picked up from your board, and where it would land
interface Press
{
    name: string;
    type: ShipType;
    heading: Heading;
    /** Its start before this press: where it is now, or its pending move. */
    from: { x: number; y: number };
    /** Which square of the ship is under the pointer. */
    grab: number;
    down: Point;
    point: Point;
    dragging: boolean;
    at: { x: number; y: number } | null;
    valid: boolean;
}

const headingOf = (s: Ship): Heading => s.getOrientation() === Orientation.HORIZONTAL ? "horizontal" : "vertical";

/**
 * Connects the AbilityCard boundary class to the battle screen: the card, the keep-or-replace
 * prompt, targeting on either board and the scan marks. Server-agnostic: pass useAbility and
 * chooseAbility for multiplayer, or Game.applyAbility and resolveOffer for the AI game.
 */
export function useAbilityTargeting(input: AbilityTargetingInput): AbilityTargeting
{
    const { heldAbility, offeredAbility, yourTurn, doubleShotActive, yourBoard, yourShots, revealedSquares, scanReset, onUse, onChoose } = input;

    const ownBoard = useBoard(yourBoard);
    const enemyBoard = useBoard({ ships: [], shots: yourShots });

    // a fresh card whenever the ability or the offer changes, so stale targeting never carries over
    const card = useMemo(() =>
    {
        const c = new AbilityCard();
        c.show(heldAbility ? createAbility(heldAbility) : null);
        const current = c.getAbility();
        const drawn = offeredAbility ? createAbility(offeredAbility) : null;
        if (current && drawn) c.showKeepOrReplace(current, drawn);
        return c;
    }, [heldAbility, offeredAbility]);
    // the turn ended (timeout or a Double Shot follow-up): drop targeting
    if (!yourTurn && card.isArmed()) card.cancel();

    // the card is a plain object, so changes to it ask for a render by hand
    const [, rerender] = useReducer((n: number) => n + 1, 0);
    const [hover, setHover] = useState<{ board: AbilityBoard; x: number; y: number } | null>(null);
    // touch screens have no hover: the first tap aims (and shows where it lands), a second tap on
    // the same square confirms
    const [aimed, setAimed] = useState<string | null>(null);
    const lastPointer = useRef("mouse");
    const [busy, setBusy] = useState(false);
    const [scanned, setScanned] = useState<string[]>([]);
    const [scansFrom, setScansFrom] = useState(scanReset);
    if (scansFrom !== scanReset)
    {
        setScansFrom(scanReset);
        setScanned([]);
    }

    if (!card.isArmed() && aimed !== null) setAimed(null);

    const ability = card.getAbility();
    const armed = card.isArmed() && !busy;
    const armedOn: AbilityBoard | null = armed ? card.targetBoard() : null;

    // Reroute by pointer: drag one of your ships to its new spot or tap it to turn it, then confirm
    const rerouting = armed && ability instanceof Reroute;
    const [moving, setMoving] = useState<{ name: string; heading: Heading; x: number; y: number } | null>(null);
    const [press, setPress] = useState<Press | null>(null);
    const pressRef = useRef<Press | null>(null);
    const ownArea = useRef<HTMLDivElement>(null);
    const [refused, setRefused] = useState<string | null>(null);
    if (!card.isArmed() && (moving !== null || refused !== null))
    {
        setMoving(null);
        setRefused(null);
    }

    // the Reroute rule (undamaged, a free square all round, nothing fired at under it), checked on
    // a Reroute of its own so the card's keyboard selection is left alone
    function canMoveTo(name: string, heading: Heading, x: number, y: number): boolean
    {
        const ship = ownBoard.getShips().find(s => s.getName() === name);
        if (!ship) return false;
        const rule = new Reroute();
        rule.selectShip(ship);
        rule.setOrientation(heading === "horizontal" ? Orientation.HORIZONTAL : Orientation.VERTICAL);
        return rule.isValidTarget(ownBoard, new Coordinate(x, y));
    }

    function ownCellAt(p: Point): { x: number; y: number } | null
    {
        const rect = ownArea.current?.querySelector(".mb-board-cells")?.getBoundingClientRect();
        if (!rect) return null;
        const size = rect.width / ownBoard.getWidth();
        const x = Math.floor((p.x - rect.left) / size);
        const y = Math.floor((p.y - rect.top) / size);
        return x >= 0 && y >= 0 && x < ownBoard.getWidth() && y < ownBoard.getHeight() ? { x, y } : null;
    }

    // event handlers only: it measures the board and checks the rule
    function track(next: Press | null)
    {
        let placed = next;
        if (next?.dragging)
        {
            const cell = ownCellAt(next.point);
            const at = cell && clampStart(
                next.type,
                cell.x - (next.heading === "horizontal" ? next.grab : 0),
                cell.y - (next.heading === "vertical" ? next.grab : 0),
                next.heading
            );
            placed = { ...next, at, valid: at !== null && canMoveTo(next.name, next.heading, at.x, at.y) };
        }
        pressRef.current = placed;
        setPress(placed);
    }

    function grabOwn(e: ReactPointerEvent<HTMLDivElement>)
    {
        if (!rerouting || e.button !== 0) return;
        const down = { x: e.clientX, y: e.clientY };
        const cell = ownCellAt(down);
        if (!cell) return;
        // the pending move is drawn on top, so it's picked up first
        let picked: { name: string; heading: Heading; from: { x: number; y: number } } | null = null;
        const movingType = moving && shipTypeFromName(moving.name);
        if (moving && movingType && squareKeys(movingType, moving.x, moving.y, moving.heading).includes(coordKey(cell.x, cell.y)))
        {
            picked = { name: moving.name, heading: moving.heading, from: { x: moving.x, y: moving.y } };
        }
        else
        {
            const ship = ownBoard.getCell(new Coordinate(cell.x, cell.y)).getShip();
            if (!ship) return;
            if (ship.isDamaged())
            {
                setRefused(`Your ${ship.getName()} has been hit, so it can't move.`);
                return;
            }
            const start = ship.getStart()!;
            picked = { name: ship.getName(), heading: headingOf(ship), from: { x: start.getX(), y: start.getY() } };
        }
        const type = shipTypeFromName(picked.name);
        if (!type) return;
        e.preventDefault();
        setRefused(null);
        const grab = picked.heading === "horizontal" ? cell.x - picked.from.x : cell.y - picked.from.y;
        track({ ...picked, type, grab, down, point: down, dragging: false, at: null, valid: false });
    }

    const onPressMove = useEffectEvent((e: PointerEvent) =>
    {
        const p = pressRef.current;
        if (!p) return;
        const point = { x: e.clientX, y: e.clientY };
        const dragging = p.dragging || Math.hypot(point.x - p.down.x, point.y - p.down.y) > DRAG_THRESHOLD_PX;
        if (dragging) e.preventDefault();
        track({ ...p, point, dragging });
    });

    const onPressUp = useEffectEvent(() =>
    {
        const p = pressRef.current;
        track(null);
        if (!p) return;
        if (!p.dragging)
        {
            // a tap turns it about the square tapped
            const next = turnAbout(p.type, p.from.x, p.from.y, p.heading, p.grab);
            if (canMoveTo(p.name, next.heading, next.x, next.y)) setMoving({ name: p.name, ...next });
            else setRefused(`No room to turn your ${p.name} there.`);
            return;
        }
        if (p.at && p.valid) setMoving({ name: p.name, heading: p.heading, ...p.at });
        else if (p.at) setRefused(`Your ${p.name} can't go there: it needs a free square all round, and no square that's been fired at.`);
        // dropped off the board: no move
        else setMoving(null);
    });

    const onPressCancel = useEffectEvent(() => track(null));

    // R turns a ship being dragged; otherwise it's the Rotate button
    const rotateKey = useEffectEvent(() =>
    {
        const p = pressRef.current;
        if (p?.dragging) track({ ...p, heading: p.heading === "horizontal" ? "vertical" : "horizontal" });
        else turn();
    });

    const pressing = press !== null;
    useEffect(() =>
    {
        if (!pressing) return;
        const move = (e: PointerEvent) => onPressMove(e);
        const up = () => onPressUp();
        const cancel = () => onPressCancel();
        window.addEventListener("pointermove", move, { passive: false });
        window.addEventListener("pointerup", up);
        window.addEventListener("pointercancel", cancel);
        return () =>
        {
            window.removeEventListener("pointermove", move);
            window.removeEventListener("pointerup", up);
            window.removeEventListener("pointercancel", cancel);
        };
    }, [pressing]);

    // Rotate (or R) while a move is pending turns it about its first square
    function turnMoving(): boolean
    {
        const type = moving && shipTypeFromName(moving.name);
        if (!moving || !type) return false;
        const next = turnAbout(type, moving.x, moving.y, moving.heading, 0);
        if (canMoveTo(moving.name, next.heading, next.x, next.y)) setMoving({ name: moving.name, ...next });
        else setRefused(`No room to turn your ${moving.name} there.`);
        return true;
    }

    function confirmMove()
    {
        const ship = moving && ownBoard.getShips().find(s => s.getName() === moving.name);
        if (!moving || !ship || !canMoveTo(moving.name, moving.heading, moving.x, moving.y)) return;
        // the card builds the request, so it gets the same choices
        card.selectShip(ownBoard, ship);
        if ((card.getRerouteOrientation() === Orientation.HORIZONTAL) !== (moving.heading === "horizontal")) card.rotate();
        setMoving(null);
        void send(new Coordinate(moving.x, moving.y));
    }

    useEffect(() =>
    {
        const note = (e: PointerEvent) => { lastPointer.current = e.pointerType; };
        window.addEventListener("pointerdown", note, true);
        return () => window.removeEventListener("pointerdown", note, true);
    }, []);

    // Escape cancels, R turns Line Scan between row and column or rotates the rerouted ship
    useEffect(() =>
    {
        if (!armed) return;
        function onKey(e: KeyboardEvent)
        {
            const field = e.target as HTMLElement | null;
            if (field?.closest("input, textarea, select, [contenteditable]")) return;
            if (e.key === "Escape") { card.cancel(); rerender(); }
            else if (e.key === "r" || e.key === "R") { rotateKey(); }
        }
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [armed, card]);

    let unavailable: string | null = null;
    if (ability)
    {
        if (busy) unavailable = "Sending…";
        else if (!yourTurn) unavailable = "You can use it on your turn.";
        else if (ability instanceof DoubleShot && doubleShotActive) unavailable = "Double Shot is already active this turn.";
        else if (ability instanceof Reroute && !ownBoard.getShips().some(s => ability.canMove(ownBoard, s)))
        {
            unavailable = "None of your ships can move: each one is damaged or boxed in.";
        }
    }

    async function send(target?: Coordinate)
    {
        const request = card.toRequest();
        setBusy(true);
        try
        {
            const ok = await onUse(request, target?.toRowCol());
            if (ok && target)
            {
                const keys = scannedSquares(request, enemyBoard, target).map(keyOf);
                if (keys.length > 0) setScanned(prev => [...new Set([...prev, ...keys])]);
            }
            if (ok) card.cancel();
        }
        finally
        {
            setBusy(false);
            rerender();
        }
    }

    function use()
    {
        if (!ability || unavailable) return;
        if (card.arm() === "fire-now") void send();
        else rerender();
    }

    function cancel()
    {
        card.cancel();
        setHover(null);
        setAimed(null);
        rerender();
    }

    // the square the ability is sent with: Radar Sweep's top left, kept on the board
    function anchor(t: Coordinate): Coordinate
    {
        if (!(card.getAbility() instanceof RadarSweep)) return t;
        const fit = (n: number, size: number) => Math.min(Math.max(n - 1, 0), size - RADAR_SPAN);
        return new Coordinate(fit(t.getX(), enemyBoard.getWidth()), fit(t.getY(), enemyBoard.getHeight()));
    }

    // false on a touch screen's first tap at a square: that tap only aims
    function confirmed(board: AbilityBoard, cell: Cell): boolean
    {
        const key = `${board}:${cell.key}`;
        if (lastPointer.current !== "touch" || aimed === key) return true;
        setAimed(key);
        setHover({ board, x: cell.x, y: cell.y });
        return false;
    }

    function onTargetClick(cell: Cell)
    {
        const t = anchor(new Coordinate(cell.x, cell.y));
        if (!card.isValidTarget(enemyBoard, t) || !confirmed("target", cell)) return;
        setAimed(null);
        void send(t);
    }

    // Reroute: a click on a valid square moves the selected ship, a click on a ship selects it
    function onOwnClick(cell: Cell)
    {
        const t = new Coordinate(cell.x, cell.y);
        if (card.getSelectedShip() && card.isValidTarget(ownBoard, t))
        {
            if (!confirmed("own", cell)) return;
            setAimed(null);
            void send(t);
            return;
        }
        const ship = ownBoard.getCell(t).getShip();
        if (ship && card.selectShip(ownBoard, ship))
        {
            setAimed(null);
            rerender();
        }
    }

    function turn()
    {
        if (turnMoving()) return;
        card.rotate();
        rerender();
    }

    function hoverOn(board: AbilityBoard)
    {
        return (cell: Cell | null) => setHover(cell ? { board, x: cell.x, y: cell.y } : null);
    }

    // what the armed ability would cover from the hovered square
    let highlight: BoardProps["highlight"];
    let ownGhost: ShipPlacement[] = [];
    if (armedOn && hover?.board === armedOn)
    {
        const board = armedOn === "own" ? ownBoard : enemyBoard;
        const t = armedOn === "target" ? anchor(new Coordinate(hover.x, hover.y)) : new Coordinate(hover.x, hover.y);
        const preview = card.previewAt(board, t);
        if (preview) highlight = { keys: preview.squares.map(keyOf), valid: preview.valid };

        const ship = card.getSelectedShip();
        const type = ship && shipTypeFromName(ship.getName());
        if (preview && type)
        {
            ownGhost = [{
                type,
                x: t.getX(),
                y: t.getY(),
                orientation: card.getRerouteOrientation() === Orientation.HORIZONTAL ? "horizontal" : "vertical",
                ghost: preview.valid ? "valid" : "invalid"
            }];
        }
    }
    let ownHalo: BoardProps["halo"];
    const shownMove = press?.dragging
        ? (press.at && { name: press.name, heading: press.heading, ...press.at, valid: press.valid })
        : moving && { ...moving, valid: true };
    const shownType = shownMove && shipTypeFromName(shownMove.name);
    if (rerouting && shownMove && shownType)
    {
        ownGhost = [{ type: shownType, x: shownMove.x, y: shownMove.y, orientation: shownMove.heading, ghost: shownMove.valid ? "valid" : "invalid" }];
        highlight = { keys: squareKeys(shownType, shownMove.x, shownMove.y, shownMove.heading), valid: shownMove.valid };
        const others = yourBoard.ships.filter(s => s.name !== shownMove.name);
        ownHalo = haloKeys(others, shownType, shownMove.x, shownMove.y, shownMove.heading);
    }
    // a selected ship with nowhere hovered yet stays outlined so it's clear which one moves
    if (armedOn === "own" && !highlight && card.getSelectedShip())
    {
        highlight = { keys: card.getSelectedShip()!.getCoordinates().map(keyOf), valid: true };
    }

    const shot = new Set(yourShots.map(s => coordKey(s.col, s.row)));
    const contacts = new Set(revealedSquares.map(s => coordKey(s.col, s.row)));
    const scanMarks: Record<string, CellMark> = {};
    for (const key of scanned) if (!shot.has(key)) scanMarks[key] = contacts.has(key) ? "contact" : "clear";
    for (const key of contacts) if (!shot.has(key)) scanMarks[key] = "contact";

    const offer = card.getOffer();
    const currentId = offer && abilityIdFromName(offer.current.getName());
    const drawnId = offer && abilityIdFromName(offer.drawn.getName());

    function answer(keep: boolean)
    {
        const asked = card.getOffer();
        card.answerOffer(keep);
        rerender();
        void Promise.resolve(onChoose(keep)).then(ok =>
        {
            // not answered after all: ask again
            if (ok === false && asked && !card.getOffer())
            {
                card.show(asked.current);
                card.showKeepOrReplace(asked.current, asked.drawn);
                rerender();
            }
        });
    }

    const turnable = armed && (ability instanceof LineScan || (ability instanceof Reroute && (card.getSelectedShip() !== null || moving !== null)));
    return {
        card: {
            ability: abilityIdFromName(ability?.getName() ?? null),
            state: armed ? "armed" : unavailable ? "unavailable" : "ready",
            onUse: use,
            onCancel: cancel,
            turn: turnable ? { label: "Rotate", onTurn: turn } : undefined,
            confirm: rerouting && moving ? { label: "Confirm move", onConfirm: confirmMove } : undefined
        },
        hint: !armed
            ? unavailable
            : refused ?? (aimed
                ? "Tap the same square again to confirm."
                : rerouting && moving
                    ? `Confirm to move your ${moving.name} there. You can still drag it, or tap it to turn it.`
                    : rerouting && !card.getSelectedShip()
                        ? "Drag one of your undamaged ships to a new spot, or tap it to turn it."
                        : hintFor(card)),
        offer: currentId && drawnId
            ? { current: currentId, drawn: drawnId, onKeep: () => answer(true), onReplace: () => answer(false) }
            : null,
        scanMarks,
        targetBoardProps: armedOn === "target"
            ? { active: true, targeting: true, sweeping: false, highlight, onCellClick: onTargetClick, onCellHover: hoverOn("target") }
            : {},
        ownBoardProps: armedOn === "own"
            ? { active: true, targeting: true, showCursor: false, highlight, halo: ownHalo, onCellClick: onOwnClick, onCellHover: hoverOn("own") }
            : {},
        ownGhost,
        ownArea: {
            ref: ownArea,
            className: rerouting ? "mb-placing" : undefined,
            onPointerDown: grabOwn,
            // pointer taps are handled above; the board's own click only answers the keyboard
            onClickCapture: (e) =>
            {
                if (rerouting && e.detail > 0) e.stopPropagation();
            }
        }
    };
}

function hintFor(card: AbilityCard): string
{
    const a = card.getAbility();
    if (a instanceof RadarSweep) return "Pick the middle of the 3×3 area to scan.";
    if (a instanceof LineScan)
    {
        return card.isLineRow()
            ? "Pick a square to scan its whole row. Rotate to scan a column."
            : "Pick a square to scan its whole column. Rotate to scan a row.";
    }
    if (a instanceof Reroute)
    {
        const ship = card.getSelectedShip();
        return ship
            ? `Pick where your ${ship.getName()} starts (its top or left end). Rotate to turn it.`
            : "Pick one of your undamaged ships to move.";
    }
    return "";
}
