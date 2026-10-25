"use client";

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

export function useGridKeyboardNav({ size = BOARD_SIZE }: GridKeyboardNavOptions = {}): GridKeyboardNav {
    void size;
    throw new Error("not yet");
}
