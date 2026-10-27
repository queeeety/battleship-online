"use client";

import { useCallback, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { BOARD_SIZE } from "@/lib/config/gameRules";

export interface GridKeyboardNavOptions {
    size?: number;
}

// Props Tim's Cell spreads onto its button: one cell has tabIndex 0, the rest -1.
export interface GridCellProps {
    tabIndex: 0 | -1;
    onKeyDown: (e: KeyboardEvent<HTMLElement>) => void;
    onFocus: () => void;
    ref: (el: HTMLElement | null) => void;
}

export interface GridKeyboardNav {
    getCellProps: (x: number, y: number) => GridCellProps;
    focusCell: (x: number, y: number) => void;
}

export interface GridPosition {
    readonly x: number;
    readonly y: number;
}

const clamp = (n: number, size: number): number => Math.min(Math.max(n, 0), size - 1);

/**
 * Where a key press moves focus, or null if the key isn't ours.
 * Pure so it can be unit tested without rendering anything.
 * Follows the ARIA grid pattern; edges stop instead of wrapping.
 */
export function nextPosition(key: string, ctrl: boolean, from: GridPosition, size: number): GridPosition | null {
    const last = size - 1;
    switch (key) {
        case "ArrowUp": return { x: from.x, y: clamp(from.y - 1, size) };
        case "ArrowDown": return { x: from.x, y: clamp(from.y + 1, size) };
        case "ArrowLeft": return { x: clamp(from.x - 1, size), y: from.y };
        case "ArrowRight": return { x: clamp(from.x + 1, size), y: from.y };
        case "Home": return ctrl ? { x: 0, y: 0 } : { x: 0, y: from.y };
        case "End": return ctrl ? { x: last, y: last } : { x: last, y: from.y };
        case "PageUp": return { x: from.x, y: 0 };
        case "PageDown": return { x: from.x, y: last };
        default: return null;
    }
}

const cellKey = (x: number, y: number): string => `${x},${y}`;

/**
 * Roving tabindex: Tab enters the board once, arrows move inside it.
 * Enter/Space are left to the cell's own button so firing stays in Tim's code.
 */
export function useGridKeyboardNav({ size = BOARD_SIZE }: GridKeyboardNavOptions = {}): GridKeyboardNav {
    const [active, setActive] = useState<GridPosition>({ x: 0, y: 0 });
    // DOM nodes aren't state (changing them shouldn't re-render), so they live in a ref
    const cells = useRef(new Map<string, HTMLElement>());

    const focusCell = useCallback((x: number, y: number): void => {
        const target = { x: clamp(x, size), y: clamp(y, size) };
        setActive(target);
        cells.current.get(cellKey(target.x, target.y))?.focus();
    }, [size]);

    const getCellProps = useCallback((x: number, y: number): GridCellProps => ({
        tabIndex: active.x === x && active.y === y ? 0 : -1,
        onKeyDown: (e) => {
            const next = nextPosition(e.key, e.ctrlKey || e.metaKey, { x, y }, size);
            if (next === null) {
                return;
            }
            // stop arrows and PageUp/Down from scrolling the page
            e.preventDefault();
            focusCell(next.x, next.y);
        },
        // keeps the tab stop in sync when a cell is clicked or focused another way
        onFocus: () => setActive({ x, y }),
        ref: (el) => {
            const k = cellKey(x, y);
            if (el) {
                cells.current.set(k, el);
            } else {
                cells.current.delete(k);
            }
        }
    }), [active, size, focusCell]);

    return { getCellProps, focusCell };
}
