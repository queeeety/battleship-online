"use client";

import { useEffect, useState } from "react";
import type { BoardProps } from "@/components/game/Board";
import { SHIPS, type ShipType } from "@/components/game/data";
import type { PlacementViewProps } from "@/components/screens/PlacementView";
import {
    FLEET_ORDER,
    clampStart,
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
    type Heading,
    type Layout
} from "@/components/screens/placement";

type Cell = { x: number; y: number; key: string };

export interface Placement {
    layout: Layout;
    complete: boolean;
    left: number;
    /** Spread onto <PlacementView> while editing. */
    editor: Pick<PlacementViewProps, "board" | "fleet" | "selected" | "onSelect" | "onRotate" | "onRandomise" | "error">;
}

const turned = (h: Heading): Heading => (h === "horizontal" ? "vertical" : "horizontal");

function firstUnplaced(layout: Layout, after?: ShipType): ShipType | null {
    const from = after ? FLEET_ORDER.indexOf(after) + 1 : 0;
    const order = [...FLEET_ORDER.slice(from), ...FLEET_ORDER.slice(0, from)];
    return order.find((type) => !isPlaced(layout, type)) ?? null;
}

/** The fleet editor: R rotates, Esc puts the selected ship down (unless `keys` is false). */
export function usePlacement(initial: Layout = [], { keys = true }: { keys?: boolean } = {}): Placement {
    const [layout, setLayout] = useState<Layout>(initial);
    const [selected, setSelected] = useState<ShipType | null>(() => firstUnplaced(initial));
    const [heading, setHeading] = useState<Heading>("horizontal");
    const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
    // a click that didn't work; cleared once the ghost moves or the ship changes
    const [failed, setFailed] = useState<string | null>(null);

    function rotate() {
        setHeading(turned);
        setFailed(null);
    }

    useEffect(() => {
        if (!keys) return;
        function onKey(e: KeyboardEvent) {
            const field = e.target as HTMLElement | null;
            if (field?.closest("input, textarea, select, [contenteditable]")) return;
            // an open dialog's Esc closes it and nothing else
            if (document.querySelector("dialog[open]")) return;
            if (e.key === "r" || e.key === "R") {
                setHeading(turned);
                setFailed(null);
            } else if (e.key === "Escape") {
                setSelected(null);
            }
        }
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [keys]);

    function select(type: ShipType) {
        // picking a placed ship from the tray lifts it off the board
        const placed = layout.find((s) => s.name === SHIPS[type].name);
        if (placed) {
            setHeading(placed.orientation);
            setLayout(removeShip(layout, type));
        }
        setSelected(type);
        setFailed(null);
    }

    function onCellClick(cell: Cell) {
        const onBoard = shipAt(layout, cell.x, cell.y);
        // a placed ship under the pointer is picked up, so it can be moved
        if (onBoard && (!selected || onBoard.type !== selected)) {
            setLayout(removeShip(layout, onBoard.type));
            setSelected(onBoard.type);
            setHeading(onBoard.heading);
            setFailed(null);
            return;
        }
        if (!selected) return;
        const start = clampStart(selected, cell.x, cell.y, heading);
        const error = placementError(layout, selected, start.x, start.y, heading);
        if (error !== null) {
            setFailed(placementErrorText(error, selected));
            return;
        }
        const next = placeShip(layout, selected, start.x, start.y, heading);
        setLayout(next);
        setSelected(firstUnplaced(next, selected));
        setFailed(null);
    }

    function onCellHover(cell: Cell | null) {
        setHover(cell && { x: cell.x, y: cell.y });
        setFailed(null);
    }

    function randomise() {
        setLayout(randomLayout());
        setSelected(null);
        setFailed(null);
    }

    const ships = toShipPlacements(layout);
    let highlight: BoardProps["highlight"];
    let hoverError: string | null = null;
    if (selected && hover) {
        const start = clampStart(selected, hover.x, hover.y, heading);
        const error = placementError(layout, selected, start.x, start.y, heading);
        // a placed ship under the pointer would be picked up, not overlapped, so no error there
        const pickingUp = shipAt(layout, hover.x, hover.y) !== null;
        if (!pickingUp) {
            ships.push({ type: selected, ...start, orientation: heading, ghost: error === null ? "valid" : "invalid" });
            highlight = { keys: squareKeys(selected, start.x, start.y, heading), valid: error === null };
            if (error !== null) hoverError = placementErrorText(error, selected);
        }
    }

    const left = FLEET_ORDER.filter((type) => !isPlaced(layout, type)).length;
    const fleet = FLEET_ORDER.map((type) => ({ type, placed: isPlaced(layout, type) }));
    const error = failed ?? hoverError;
    const boardProps = { ships, highlight, active: true, targeting: true, onCellClick, onCellHover };
    return {
        layout,
        complete: left === 0 && isComplete(layout),
        left,
        editor: { board: boardProps, fleet, selected, onSelect: select, onRotate: rotate, onRandomise: randomise, error }
    };
}
