"use client";

import { useEffect, useEffectEvent, useState } from "react";
import { secondsLeft } from "@/components/screens/turnClock";

// the server fires only once the limit has passed by its own clock, so give it a moment
const FIRST_CLAIM_DELAY_MS = 750;
const CLAIM_RETRY_MS = 1000;
const MAX_TRIES = 10;
// after MAX_TRIES refusals the view is probably stale, so refetch
const BACKOFF_MS = 5000;
const TICK_MS = 250;

export interface TurnClockInput {
    total: number;
    turnStartedAt: string | null;
    /** When the player to move disconnected; the server pauses their clock. */
    pausedAt: string | null;
    live: boolean;
    /** Asks for the timed-out player's random shot; true once it was fired. */
    claim: () => Promise<boolean>;
    /** Refetches the view after a fired shot or a run of refused claims. */
    onStuck: () => void;
}

/** The turn's countdown. At 0 it asks for the random shot until a new turn starts; online either player may ask. */
export function useTurnClock({ total, turnStartedAt, pausedAt, live, claim, onStuck }: TurnClockInput): number {
    const [now, setNow] = useState<number | null>(null);
    const ask = useEffectEvent(() => claim());
    const stuck = useEffectEvent(() => onStuck());

    useEffect(() => {
        if (!live) return;
        const id = setInterval(() => setNow(Date.now()), TICK_MS);
        return () => clearInterval(id);
    }, [live]);

    useEffect(() => {
        if (!live || !turnStartedAt || pausedAt) return;
        const deadline = Date.parse(turnStartedAt) + total * 1000;
        let stopped = false;
        let tries = 0;
        let timer: ReturnType<typeof setTimeout>;

        function attempt() {
            void ask().then((fired) => {
                if (stopped) return;
                if (fired) {
                    stuck();
                    return;
                }
                tries++;
                if (tries < MAX_TRIES) {
                    timer = setTimeout(attempt, CLAIM_RETRY_MS);
                } else {
                    tries = 0;
                    stuck();
                    timer = setTimeout(attempt, BACKOFF_MS);
                }
            });
        }

        timer = setTimeout(attempt, Math.max(0, deadline - Date.now()) + FIRST_CLAIM_DELAY_MS);
        return () => {
            stopped = true;
            clearTimeout(timer);
        };
    }, [total, turnStartedAt, pausedAt, live]);

    return now === null ? total : secondsLeft({ total, turnStartedAt, now, pausedAt });
}
