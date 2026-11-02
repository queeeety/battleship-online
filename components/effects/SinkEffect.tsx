"use client";

import type { ReactElement } from "react";
import { motion } from "framer-motion";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import type { EffectProps } from "./HitEffect";

const REST = { rotate: 0, scale: 1, opacity: 1 };
// wobble and dip, like the ship rolling over
const SINK = { rotate: [0, -8, 6, -4, 0], scale: [1, 0.85, 0.9, 1] };
// two blinks instead of movement, so a sink still reads differently from a hit
const SINK_REDUCED = { opacity: [1, 0.3, 1, 0.3, 1] };

export function SinkEffect({ active, children, className = "", onComplete }: EffectProps): ReactElement {
    const reduceMotion = useReducedMotion();
    const target = !active ? REST : reduceMotion ? SINK_REDUCED : SINK;

    return (
        <motion.div
            className={`relative ${className}`}
            animate={target}
            transition={{ duration: reduceMotion ? 0.4 : 0.6 }}
            onAnimationComplete={active ? onComplete : undefined}
        >
            {children}
        </motion.div>
    );
}
