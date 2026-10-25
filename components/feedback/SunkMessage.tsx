"use client";

import type { ReactElement } from "react";

export interface SunkMessageProps {
    // null hides the banner; the live region stays mounted so screen readers announce changes
    shipName: string | null;
    by: "you" | "opponent";
}

export function SunkMessage(props: SunkMessageProps): ReactElement | null {
    void props;
    return null;
}
