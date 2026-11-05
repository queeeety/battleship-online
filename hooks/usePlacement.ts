"use client";

import { useEffect, useEffectEvent, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { BoardProps } from "@/components/game/Board";
import { SHIPS, type ShipType } from "@/components/game/data";
import type { PlacementViewProps } from "@/components/screens/PlacementView";
import {
    FLEET_ORDER,
    clampStart,
    haloKeys,
    isComplete,
    isPlaced,
    placeShip,
    placementError,
    placementErrorText,
    randomLayout,
    removeShip,
    shipAt,
    squareKeys,
    toShipPlacements,
    turnAbout,
    type Heading,
    type Layout
} from "@/components/screens/placement";
import { BOARD_SIZE } from "@/lib/config";

type Cell = { x: number; y: number; key: string };
type Point = { x: number; y: number };

// a press that moves less than this is a click
const DRAG_THRESHOLD_PX = 6;

interface Press {
    type: ShipType;
    from: "deck" | "board";
    heading: Heading;
    /** Which square of the ship is under the pointer. */
    grab: number;
    /** Where it sat on the board before it was picked up. */
    origin: { x: number; y: number } | null;
    down: Point;
    point: Point;
    dragging: boolean;
    /** Where it would start if dropped now; null off the board. */
    at: { x: number; y: number } | null;
    /** The board's cell size in px, for the copy drawn off the board. */
    cell: number;
}

export interface Placement {
    layout: Layout;
    complete: boolean;
    left: number;
    /** Spread onto <PlacementView> while editing. */
    editor: Pick<PlacementViewProps, "board" | "boardArea" | "deck" | "drag" | "onRandomise" | "error">;
}

const turned = (h: Heading): Heading => (h === "horizontal" ? "vertical" : "horizontal");

/**
 * The fleet editor. Ships are dragged from the deck onto the board, or around it; a drop that
 * breaks the rules sends the ship back to the deck, and a click on a placed ship turns it about
 * the square clicked.
 * With the keyboard: pick a ship in the deck, move with the board's arrow keys, Enter places,
 * R turns, Esc puts it down (`keys: false` turns R and Esc off).
 */
export function usePlacement(initial: Layout = [], { keys = true }: { keys?: boolean } = {}): Placement {
    const [layout, setLayout] = useState<Layout>(initial);
    const [press, setPress] = useState<Press | null>(null);
    const pressRef = useRef<Press | null>(null);
    const area = useRef<HTMLDivElement>(null);
    // keyboard placement
    const [selected, setSelected] = useState<ShipType | null>(null);
    const [heading, setHeading] = useState<Heading>("horizontal");
    const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
    // the last move that didn't work; cleared by the next one
    const [failed, setFailed] = useState<string | null>(null);

    // event handlers only: it measures the board
    function track(next: Press | null) {
        const placed = next && { ...next, at: next.dragging ? startFor(next) : null };
        pressRef.current = placed;
        setPress(placed);
    }

    function cellsRect(): DOMRect | null {
        return area.current?.querySelector(".mb-board-cells")?.getBoundingClientRect() ?? null;
    }

    function cellAt(p: Point): { x: number; y: number } | null {
        const rect = cellsRect();
        if (!rect) return null;
        const size = rect.width / BOARD_SIZE;
        const x = Math.floor((p.x - rect.left) / size);
        const y = Math.floor((p.y - rect.top) / size);
        return x >= 0 && y >= 0 && x < BOARD_SIZE && y < BOARD_SIZE ? { x, y } : null;
    }

    // where the dragged ship would start if dropped now, or null off the board
    function startFor(p: Omit<Press, "at">): { x: number; y: number } | null {
        const cell = cellAt(p.point);
        if (!cell) return null;
        const x = cell.x - (p.heading === "horizontal" ? p.grab : 0);
        const y = cell.y - (p.heading === "vertical" ? p.grab : 0);
        return clampStart(p.type, x, y, p.heading);
    }

    function begin(p: Omit<Press, "point" | "dragging" | "at" | "cell">) {
        setFailed(null);
        setSelected(null);
        const rect = cellsRect();
        track({ ...p, point: p.down, dragging: false, at: null, cell: rect ? rect.width / BOARD_SIZE : 32 });
    }

    function grabFromDeck(type: ShipType, e: ReactPointerEvent<HTMLButtonElement>) {
        if (e.button !== 0) return;
        e.preventDefault();
        // the square under the pointer, counted along the ship drawn in the row (its nearest end
        // when the row is grabbed by the name)
        const rect = (e.currentTarget.querySelector(".mb-deck-ship") ?? e.currentTarget).getBoundingClientRect();
        const length = SHIPS[type].length;
        const grab = Math.min(length - 1, Math.max(0, Math.floor(((e.clientX - rect.left) / rect.width) * length)));
        begin({ type, from: "deck", heading: "horizontal", grab, origin: null, down: { x: e.clientX, y: e.clientY } });
    }

    function grabFromBoard(e: ReactPointerEvent<HTMLDivElement>) {
        if (e.button !== 0) return;
        const down = { x: e.clientX, y: e.clientY };
        const cell = cellAt(down);
        const ship = cell && shipAt(layout, cell.x, cell.y);
        if (!cell || !ship) return;
        e.preventDefault();
        const grab = ship.heading === "horizontal" ? cell.x - ship.x : cell.y - ship.y;
        begin({ type: ship.type, from: "board", heading: ship.heading, grab, origin: { x: ship.x, y: ship.y }, down });
    }

    // a click on a placed ship turns it about the square clicked, if there's room
    function turn(type: ShipType, start: { x: number; y: number }, from: Heading, at: number) {
        const without = removeShip(layout, type);
        const next = turnAbout(type, start.x, start.y, from, at);
        if (placementError(without, type, next.x, next.y, next.heading) === null) {
            setLayout(placeShip(without, type, next.x, next.y, next.heading));
        } else {
            setFailed(`No room to turn the ${SHIPS[type].name} here.`);
        }
    }

    const onMove = useEffectEvent((e: PointerEvent) => {
        const p = pressRef.current;
        if (!p) return;
        const point = { x: e.clientX, y: e.clientY };
        const dragging = p.dragging || Math.hypot(point.x - p.down.x, point.y - p.down.y) > DRAG_THRESHOLD_PX;
        // lifted off the board once it really moves, so the rules no longer see it there
        if (dragging && !p.dragging && p.from === "board") setLayout((l) => removeShip(l, p.type));
        if (dragging) e.preventDefault();
        track({ ...p, point, dragging });
    });

    const onUp = useEffectEvent((e: PointerEvent) => {
        const p = pressRef.current;
        if (!p) return;
        track(null);
        if (!p.dragging) {
            if (p.from === "board" && p.origin) turn(p.type, p.origin, p.heading, p.grab);
            return;
        }
        const start = startFor({ ...p, point: { x: e.clientX, y: e.clientY } });
        if (!start) return; // dropped off the board: back to the deck
        const error = placementError(layout, p.type, start.x, start.y, p.heading);
        if (error === null) setLayout(placeShip(layout, p.type, start.x, start.y, p.heading));
        else setFailed(`${placementErrorText(error, p.type)} It went back to the fleet.`);
    });

    const onCancel = useEffectEvent(() => {
        const p = pressRef.current;
        track(null);
        const origin = p?.dragging ? p.origin : null;
        if (p && origin) setLayout((l) => placeShip(l, p.type, origin.x, origin.y, p.heading));
    });

    const pressing = press !== null;
    useEffect(() => {
        if (!pressing) return;
        const move = (e: PointerEvent) => onMove(e);
        const up = (e: PointerEvent) => onUp(e);
        const cancel = () => onCancel();
        window.addEventListener("pointermove", move, { passive: false });
        window.addEventListener("pointerup", up);
        window.addEventListener("pointercancel", cancel);
        return () => {
            window.removeEventListener("pointermove", move);
            window.removeEventListener("pointerup", up);
            window.removeEventListener("pointercancel", cancel);
        };
    }, [pressing]);

    const onKey = useEffectEvent((e: KeyboardEvent) => {
        const field = e.target as HTMLElement | null;
        if (field?.closest("input, textarea, select, [contenteditable]")) return;
        // an open dialog's Esc closes it and nothing else
        if (document.querySelector("dialog[open]")) return;
        const p = pressRef.current;
        if (e.key === "r" || e.key === "R") {
            if (p?.dragging) track({ ...p, heading: turned(p.heading) });
            else setHeading(turned);
            setFailed(null);
        } else if (e.key === "Escape") {
            // a dragged ship goes back to the deck
            if (p?.dragging) track(null);
            setSelected(null);
        }
    });

    useEffect(() => {
        if (!keys) return;
        const listener = (e: KeyboardEvent) => onKey(e);
        window.addEventListener("keydown", listener);
        return () => window.removeEventListener("keydown", listener);
    }, [keys]);

    // keyboard: Enter places the picked ship, or picks up the placed one under the cursor
    function onCellClick(cell: Cell) {
        setFailed(null);
        if (!selected) {
            const ship = shipAt(layout, cell.x, cell.y);
            if (!ship) return;
            setLayout(removeShip(layout, ship.type));
            setSelected(ship.type);
            setHeading(ship.heading);
            return;
        }
        const start = clampStart(selected, cell.x, cell.y, heading);
        const error = placementError(layout, selected, start.x, start.y, heading);
        if (error !== null) {
            setFailed(placementErrorText(error, selected));
            return;
        }
        setLayout(placeShip(layout, selected, start.x, start.y, heading));
        setSelected(null);
    }

    function selectFromDeck(type: ShipType) {
        setSelected(type);
        setHeading("horizontal");
        setFailed(null);
    }

    function randomise() {
        setLayout(randomLayout());
        setSelected(null);
        setFailed(null);
    }

    // the ship being moved, by pointer or keyboard, and where it would land
    const dragged = press?.dragging ? press : null;
    const moving = dragged ? { type: dragged.type, heading: dragged.heading } : selected ? { type: selected, heading } : null;
    const at = dragged ? dragged.at : selected && hover ? clampStart(selected, hover.x, hover.y, heading) : null;

    const ships = toShipPlacements(layout);
    let highlight: BoardProps["highlight"];
    let halo: BoardProps["halo"];
    let hoverError: string | null = null;
    if (moving && at) {
        const error = placementError(layout, moving.type, at.x, at.y, moving.heading);
        ships.push({ type: moving.type, ...at, orientation: moving.heading, ghost: error === null ? "valid" : "invalid" });
        highlight = { keys: squareKeys(moving.type, at.x, at.y, moving.heading), valid: error === null };
        halo = haloKeys(layout, moving.type, at.x, at.y, moving.heading);
        if (error !== null) hoverError = placementErrorText(error, moving.type);
    } else if (!press && hover) {
        // with no ship in hand, the placed ship under the pointer or keyboard cursor lights up
        const ship = shipAt(layout, hover.x, hover.y);
        if (ship) highlight = { keys: squareKeys(ship.type, ship.x, ship.y, ship.heading), valid: true };
    }

    // off the board the dragged ship follows the pointer, held where it was grabbed
    const drag: PlacementViewProps["drag"] =
        dragged && !at
            ? {
                  type: dragged.type,
                  heading: dragged.heading,
                  cell: dragged.cell,
                  left: dragged.point.x - (dragged.heading === "horizontal" ? dragged.grab + 0.5 : 0.5) * dragged.cell,
                  top: dragged.point.y - (dragged.heading === "vertical" ? dragged.grab + 0.5 : 0.5) * dragged.cell
              }
            : null;

    const left = FLEET_ORDER.filter((type) => !isPlaced(layout, type)).length;
    return {
        layout,
        complete: left === 0 && isComplete(layout),
        left,
        editor: {
            board: {
                ships,
                highlight,
                halo,
                active: true,
                targeting: true,
                showCursor: false,
                onCellClick,
                onCellHover: (cell) => setHover(cell && { x: cell.x, y: cell.y })
            },
            boardArea: {
                ref: area,
                onPointerDown: grabFromBoard,
                // pointer clicks are handled above; the board's own click only answers the keyboard
                onClickCapture: (e) => {
                    if (e.detail > 0) e.stopPropagation();
                }
            },
            deck: {
                ships: FLEET_ORDER.map((type) => ({ type, placed: isPlaced(layout, type) })),
                lifted: dragged?.from === "deck" ? dragged.type : null,
                selected,
                onGrab: grabFromDeck,
                onSelect: selectFromDeck
            },
            drag,
            onRandomise: randomise,
            error: failed ?? hoverError
        }
    };
}
