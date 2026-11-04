"use client";

import type { ReactElement } from "react";
import { motion } from "framer-motion";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import type { EffectProps } from "./HitEffect";

export function MissEffect({ active, children, className = "relative", onComplete }: EffectProps): ReactElement {
    const reduceMotion = useReducedMotion();
    const showRipple = active && !reduceMotion;
    const blink = active && reduceMotion;

    return (
        <motion.div
            className={className}
            animate={blink ? { opacity: [1, 0.4, 1] } : { opacity: 1 }}
            transition={{ duration: 0.2 }}
            onAnimationComplete={blink ? onComplete : undefined}
        >
            {children}
            {/* a splash ring growing out of the cell; pointer-events-none so it never blocks clicks */}
            {showRipple && (
                <motion.span
                    aria-hidden="true"
                    className="mb-fx-ripple"
                    initial={{ scale: 0.2, opacity: 0.9 }}
                    animate={{ scale: 1.4, opacity: 0 }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    onAnimationComplete={onComplete}
                />
            )}
        </motion.div>
    );
}
