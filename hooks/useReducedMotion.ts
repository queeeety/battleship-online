"use client";

import { useReducedMotion as useFramerReducedMotion } from "framer-motion";

// Framer gives null until it has read the OS setting, so treat that as "no preference".
export function useReducedMotion(): boolean {
    return useFramerReducedMotion() ?? false;
}
