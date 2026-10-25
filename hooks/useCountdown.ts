"use client";

import { useEffect, useState } from "react";
import { Timer } from "@/lib/boundary/Timer";

// how often we re-read the timer; fast enough that the digit never lags a visible second
const POLL_MS = 200;

export interface CountdownState {
    secondsLeft: number;
    hasExpired: boolean;
}

/**
 * Runs a Timer for totalMs and reports what is left.
 * The Timer owns the timing, this only polls it.
 */
export function useCountdown(totalMs: number): CountdownState {
    const [state, setState] = useState<CountdownState>({
        secondsLeft: Math.ceil(totalMs / 1000),
        hasExpired: false
    });

    useEffect(() => {
        const timer = new Timer();
        timer.start(totalMs);

        const id = setInterval(() => {
            const secondsLeft = Math.ceil(timer.secondsLeft());
            const hasExpired = timer.hasExpired();
            // return the same object when nothing changed so React skips the re-render
            setState((prev) =>
                prev.secondsLeft === secondsLeft && prev.hasExpired === hasExpired
                    ? prev
                    : { secondsLeft, hasExpired }
            );
        }, POLL_MS);

        return () => {
            clearInterval(id);
            timer.stop();
        };
    }, [totalMs]);

    return state;
}
