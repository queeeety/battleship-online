"use client";

import type { ReactElement } from "react";
import { motion } from "framer-motion";
import { PLAYER_NAME_MAX_LENGTH } from "@/lib/config";
import { JoinError, PlacementError } from "@/lib/enums";
import { useReducedMotion } from "@/hooks/useReducedMotion";

// The enums are numeric and overlap (both start at 0), so the kind has to travel with the value.
export type ErrorStateKind =
    | { kind: "join"; error: JoinError }
    | { kind: "placement"; error: PlacementError };

export type ErrorStateProps = ErrorStateKind & {
    actionLabel?: string;
    onAction?: () => void;
};

interface ErrorText {
    readonly title: string;
    readonly detail: string;
}

// Record<Enum, ...> makes the compiler complain if someone adds an error without a message
const JOIN_TEXT: Readonly<Record<JoinError, ErrorText>> = {
    [JoinError.CODE_NOT_FOUND]: {
        title: "Code not found",
        detail: "Check the code and try again."
    },
    [JoinError.LOBBY_FULL]: {
        title: "Lobby is full",
        detail: "This game already has two players."
    },
    [JoinError.GAME_ALREADY_FINISHED]: {
        title: "Game has finished",
        detail: "This game is over. Start a new one from the home screen."
    },
    [JoinError.INVALID_NAME]: {
        title: "Name not allowed",
        detail: `Use 1 to ${PLAYER_NAME_MAX_LENGTH} characters, or leave it blank for a random name.`
    }
};

const PLACEMENT_TEXT: Readonly<Record<PlacementError, ErrorText>> = {
    [PlacementError.OUT_OF_BOUNDS]: {
        title: "Ship is off the board",
        detail: "Move or rotate it so it fits inside the grid."
    },
    [PlacementError.OVERLAPS_SHIP]: {
        title: "Ships overlap",
        detail: "Ships can't share a cell. Move it to an empty spot."
    },
    [PlacementError.ALREADY_PLACED]: {
        title: "Ship already placed",
        detail: "Pick a ship that isn't on the board yet."
    },
    [PlacementError.FLEET_INCOMPLETE]: {
        title: "Fleet not ready",
        detail: "Place every ship before you confirm."
    }
};

// join errors block you (red, cross), placement errors are fixable (amber, triangle)
const STYLE = {
    join: "border-red-600 bg-red-50 text-red-900 dark:bg-red-950 dark:text-red-100",
    placement: "border-amber-500 bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-100"
} as const;

function ErrorIcon({ kind }: { kind: ErrorStateKind["kind"] }): ReactElement {
    return (
        <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="size-6 shrink-0"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            {kind === "join" ? (
                <>
                    <circle cx="12" cy="12" r="10" />
                    <path d="M15 9l-6 6M9 9l6 6" />
                </>
            ) : (
                <>
                    <path d="M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" />
                    <path d="M12 9v4M12 17h.01" />
                </>
            )}
        </svg>
    );
}

export function ErrorState(props: ErrorStateProps): ReactElement {
    const { actionLabel = "Try again", onAction } = props;
    const reduceMotion = useReducedMotion();
    const text = props.kind === "join" ? JOIN_TEXT[props.error] : PLACEMENT_TEXT[props.error];

    return (
        <motion.div
            role="alert"
            className={`flex w-full max-w-sm flex-col gap-3 rounded-lg border-2 p-4 ${STYLE[props.kind]}`}
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
            animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
        >
            <div className="flex items-start gap-3">
                <ErrorIcon kind={props.kind} />
                <div className="min-w-0">
                    <p className="font-semibold">{text.title}</p>
                    <p className="text-sm">{text.detail}</p>
                </div>
            </div>
            {onAction && (
                <button
                    type="button"
                    onClick={onAction}
                    className="min-h-11 w-full rounded-md border-2 border-current px-4 font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current sm:w-auto sm:self-end"
                >
                    {actionLabel}
                </button>
            )}
        </motion.div>
    );
}
