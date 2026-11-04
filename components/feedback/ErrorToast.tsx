"use client";

import type { ReactElement } from "react";
import { motion } from "framer-motion";
import { Toast } from "@/components/ui";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { errorText, type ServerFailure } from "./ErrorState";

export interface ErrorToastProps {
    error: ServerFailure;
    onClose?: () => void;
}

// For failures where errorPresentation says "toast": the player retries and keeps playing.
export function ErrorToast({ error, onClose }: ErrorToastProps): ReactElement {
    const reduceMotion = useReducedMotion();
    const text = errorText({ kind: "server", error });

    return (
        <motion.div
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
            animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
        >
            <Toast icon="warning" onClose={onClose}>
                <strong>{text.title}.</strong> {text.detail}
            </Toast>
        </motion.div>
    );
}
