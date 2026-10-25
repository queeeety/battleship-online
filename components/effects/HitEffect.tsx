"use client";

import type { ReactElement, ReactNode } from "react";

// Shared by HitEffect, MissEffect and SinkEffect.
export interface EffectProps {
    active: boolean;
    children: ReactNode;
    className?: string;
    onComplete?: () => void;
}

export function HitEffect(props: EffectProps): ReactElement | null {
    void props;
    return null;
}
