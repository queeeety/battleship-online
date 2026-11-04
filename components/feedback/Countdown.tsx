"use client";

import { useEffect, useRef } from "react";
import type { ReactElement } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useCountdown } from "@/hooks/useCountdown";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { audio } from "@/lib/audio";

const DEFAULT_FROM_SECONDS = 3;

export interface CountdownProps {
    from?: number;
    onComplete: () => void;
}

export function Countdown({ from = DEFAULT_FROM_SECONDS, onComplete }: CountdownProps): ReactElement {
    const { secondsLeft, hasExpired } = useCountdown(from * 1000);
    const reduceMotion = useReducedMotion();
    const completed = useRef(false);

    // hasExpired can stay true across renders, so guard to call onComplete once
    useEffect(() => {
        if (!hasExpired || completed.current) {
            return;
        }
        completed.current = true;
        onComplete();
    }, [hasExpired, onComplete]);

    // remember the last number ticked so re-renders never tick it twice
    const lastTicked = useRef<number | null>(null);
    useEffect(() => {
        if (hasExpired || lastTicked.current === secondsLeft) {
            return;
        }
        lastTicked.current = secondsLeft;
        audio.play("tick");
    }, [secondsLeft, hasExpired]);

    const label = hasExpired ? "Go!" : String(secondsLeft);
    // transforms are dropped for reduced motion, opacity is safe to keep
    const hidden = reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.5 };
    const shown = reduceMotion ? { opacity: 1 } : { opacity: 1, scale: 1 };
    const gone = reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 1.5 };

    return (
        <div className="mb-countdown">
            <AnimatePresence mode="wait">
                <motion.span
                    key={label}
                    aria-hidden="true"
                    className="mb-countdown-read"
                    initial={hidden}
                    animate={shown}
                    exit={gone}
                    transition={{ duration: reduceMotion ? 0.15 : 0.3 }}
                >
                    {label}
                </motion.span>
            </AnimatePresence>
            <p role="status" className="mb-sr">
                {hasExpired ? "Go!" : `Starting in ${secondsLeft}`}
            </p>
        </div>
    );
}
