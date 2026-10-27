"use client";

import type { ReactElement } from "react";
import { motion } from "framer-motion";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import type { EffectProps } from "./HitEffect";

export function MissEffect({ active, children, className = "", onComplete }: EffectProps): ReactElement {
    const reduceMotion = useReducedMotion();
    const showRipple = active && !reduceMotion;
    const blink = active && reduceMotion;

    return (
        <motion.div
            className={`relative ${className}`}
            animate={blink ? { opacity: [1, 0.4, 1] } : { opacity: 1 }}
            transition={{ duration: 0.2 }}
            onAnimationComplete={blink ? onComplete : undefined}
        >
            {children}
            {/* a splash ring growing out of the cell; pointer-events-none so it never blocks clicks */}
            {showRipple && (
                <motion.span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 rounded-full border-2 border-sky-500"
                    initial={{ scale: 0.2, opacity: 0.9 }}
                    animate={{ scale: 1.4, opacity: 0 }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    onAnimationComplete={onComplete}
                />
            )}
        </motion.div>
    );
}
