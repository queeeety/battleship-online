"use client";

import type { ReactElement, ReactNode } from "react";
import { motion } from "framer-motion";
import { useReducedMotion } from "@/hooks/useReducedMotion";

// Shared by HitEffect, MissEffect and SinkEffect.
export interface EffectProps {
    active: boolean;
    children: ReactNode;
    // defaults to "relative"; Board passes its own class to lay the effect over a cell
    className?: string;
    onComplete?: () => void;
}

const REST = { x: 0, scale: 1, opacity: 1 };
// short shake with a pop, the cell itself draws the hit icon and colour
const HIT = { x: [0, -3, 3, -2, 0], scale: [1, 1.15, 1] };
// no movement for reduced motion, just a quick blink
const HIT_REDUCED = { opacity: [1, 0.4, 1] };

export function HitEffect({ active, children, className = "relative", onComplete }: EffectProps): ReactElement {
    const reduceMotion = useReducedMotion();
    const target = !active ? REST : reduceMotion ? HIT_REDUCED : HIT;

    return (
        <motion.div
            className={className}
            animate={target}
            transition={{ duration: reduceMotion ? 0.2 : 0.35 }}
            // also fires when returning to REST, so only report the real effect
            onAnimationComplete={active ? onComplete : undefined}
        >
            {children}
        </motion.div>
    );
}
