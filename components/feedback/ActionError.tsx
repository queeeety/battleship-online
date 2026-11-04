"use client";

import { useEffect, useEffectEvent, useRef } from "react";
import type { ReactElement } from "react";
import { ErrorState, isToastFailure, toErrorKind, type ActionFailure } from "./ErrorState";
import { ErrorToast } from "./ErrorToast";

export interface ActionErrorProps {
    error: ActionFailure;
    /** Close button on the toast. Full error cards have no close. */
    onClose?: () => void;
    /** Button on the full error card. */
    onAction?: () => void;
    /** Called once when error becomes "STALE", e.g. to refetch the game. */
    onStale?: () => void;
    /** Overrides the per-failure default label. */
    actionLabel?: string;
}

/** True only for a STALE we haven't reacted to yet. */
export function shouldFireStale(error: ActionFailure, alreadyFired: boolean): boolean {
    return error === "STALE" && !alreadyFired;
}

/**
 * Shows any action failure the right way: a toast if the player can carry on, a full card if not.
 * Usage: <ActionError error={res.error} onClose={...} onStale={refetch} />
 * Two STALEs in a row keep the same error value, so give each failed request a new `key`
 * if you want onStale to fire again.
 */
export function ActionError({ error, onClose, onAction, onStale, actionLabel }: ActionErrorProps): ReactElement {
    // Ref survives React dev mode's run-cleanup-run of effects, so the second run sees it's set.
    const firedForStale = useRef(false);
    // Always calls the latest onStale without making it a dependency, so an inline
    // `onStale={() => refetch()}` doesn't re-run the effect on every render.
    const fireStale = useEffectEvent(() => onStale?.());

    useEffect(() => {
        if (shouldFireStale(error, firedForStale.current)) {
            firedForStale.current = true;
            fireStale();
        } else if (error !== "STALE") {
            firedForStale.current = false; // a later STALE should fire again
        }
    }, [error]);

    if (isToastFailure(error)) {
        return <ErrorToast error={error} onClose={onClose} />;
    }
    return <ErrorState {...toErrorKind(error)} actionLabel={actionLabel} onAction={onAction} />;
}
