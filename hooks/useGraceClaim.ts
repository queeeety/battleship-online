"use client";

import { useEffect, useEffectEvent, useState } from "react";
import { DISCONNECT_GRACE_PERIOD_MS } from "@/lib/config";

// the server refuses until its own clock agrees the grace period is up
const CLAIM_RETRY_MS = 2000;

/** Seconds left of an absent opponent's grace period (null if nobody is away); at 0 it keeps calling `claim`. */
export function useGraceClaim(disconnectedAt: string | null, claim: () => Promise<unknown>): number | null {
    const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
    const ask = useEffectEvent(() => claim());

    useEffect(() => {
        if (!disconnectedAt) return;
        const deadline = Date.parse(disconnectedAt) + DISCONNECT_GRACE_PERIOD_MS;
        let lastClaim = 0;
        let claiming = false;

        function tick() {
            const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
            setSecondsLeft(left);
            if (left > 0 || claiming || Date.now() - lastClaim < CLAIM_RETRY_MS) return;
            claiming = true;
            lastClaim = Date.now();
            void ask().then(() => {
                claiming = false;
            });
        }

        const first = setTimeout(tick, 0);
        const id = setInterval(tick, 1000);
        return () => {
            clearTimeout(first);
            clearInterval(id);
            setSecondsLeft(null);
        };
    }, [disconnectedAt]);

    return disconnectedAt ? secondsLeft : null;
}
