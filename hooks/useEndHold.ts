"use client";

import { useEffect, useState } from "react";
import { EndReason } from "@/lib/enums";

// long enough to see the last shot land and read its notice before the result takes over
const HOLD_MS = 2500;

/**
 * The screen to show: `screen`, except that when a battle ends with a fleet sunk, the battle
 * stays up a moment longer so the last shot can be seen landing.
 */
export function useEndHold<S extends string>(screen: S, endReason: EndReason | null): S {
    const [shown, setShown] = useState(screen);
    const [held, setHeld] = useState<S | null>(null);
    if (screen !== shown && held === null) {
        if (shown === "battle" && screen === "result" && endReason === EndReason.FLEET_DESTROYED) setHeld(screen);
        else setShown(screen);
    }

    useEffect(() => {
        if (held === null) return;
        const id = setTimeout(() => {
            setShown(held);
            setHeld(null);
        }, HOLD_MS);
        return () => clearTimeout(id);
    }, [held]);

    return shown;
}
