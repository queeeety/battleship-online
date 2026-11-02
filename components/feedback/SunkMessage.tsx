"use client";

import type { ReactElement } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useReducedMotion } from "@/hooks/useReducedMotion";

export interface SunkMessageProps {
    // null hides the banner; the live region stays mounted so screen readers announce changes
    shipName: string | null;
    by: "you" | "opponent";
}

// your win is green, your loss is red; wording and icon also differ so colour isn't the only cue
const STYLE = {
    you: "border-emerald-600 bg-emerald-50 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100",
    opponent: "border-red-600 bg-red-50 text-red-900 dark:bg-red-950 dark:text-red-100"
} as const;

function sunkText(shipName: string, by: SunkMessageProps["by"]): string {
    return by === "you" ? `You sank their ${shipName}!` : `Your ${shipName} was sunk`;
}

function ShipDownIcon(): ReactElement {
    return (
        <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="size-7 shrink-0"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            {/* tilted hull going under the waves */}
            <path d="M4 13l13-4 2 4-11 3.5z" />
            <path d="M10 11.2V6l4 1.5" />
            <path d="M2 20c2 0 2-1.5 4-1.5s2 1.5 4 1.5 2-1.5 4-1.5 2 1.5 4 1.5 2-1.5 4-1.5" />
        </svg>
    );
}

export function SunkMessage({ shipName, by }: SunkMessageProps): ReactElement {
    const reduceMotion = useReducedMotion();
    const text = shipName === null ? "" : sunkText(shipName, by);

    return (
        <div className="flex w-full justify-center">
            {/* screen readers get this one; the banner below is hidden from them to avoid reading twice */}
            <p role="status" className="sr-only">
                {text}
            </p>
            <AnimatePresence>
                {shipName !== null && (
                    <motion.div
                        key={`${by}-${shipName}`}
                        aria-hidden="true"
                        className={`flex w-full max-w-sm items-center gap-3 rounded-lg border-2 px-4 py-3 ${STYLE[by]}`}
                        initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.8, y: -12 }}
                        animate={reduceMotion ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
                        exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -12 }}
                        transition={
                            reduceMotion ? { duration: 0.15 } : { type: "spring", stiffness: 400, damping: 22 }
                        }
                    >
                        <ShipDownIcon />
                        <p className="min-w-0 text-lg font-bold">{text}</p>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
