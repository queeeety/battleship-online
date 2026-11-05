"use client";

import { useEffect, useRef } from "react";

// focuses the new screen's heading so screen readers announce the change (not on first load)
export function useScreenFocus(screen: string): void {
    const last = useRef(screen);

    useEffect(() => {
        if (last.current === screen) return;
        last.current = screen;
        const heading = document.querySelector<HTMLElement>("main h1");
        if (!heading) return;
        heading.tabIndex = -1;
        heading.focus({ preventScroll: true });
    }, [screen]);
}
