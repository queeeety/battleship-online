"use client";

import type { ReactElement } from "react";
import { Toast } from "@/components/ui";

export interface SunkMessageProps {
    shipName: string;
    by: "you" | "opponent";
    opponentName: string;
    onClose?: () => void;
}

// wording as in Figma "Battle - 33": "Teddy sank your Destroyer."
export function sunkText(shipName: string, by: SunkMessageProps["by"], opponentName: string): string {
    return by === "you" ? `You sank ${opponentName}’s ${shipName}.` : `${opponentName} sank your ${shipName}.`;
}

/**
 * The sunk notice, drawn with the shared Toast (its role="status" announces it).
 * Your loss gets the warning icon (neutral, as in Figma), your win the target icon in sonar teal,
 * so the two read differently without relying on colour.
 */
export function SunkMessage({ shipName, by, opponentName, onClose }: SunkMessageProps): ReactElement {
    return (
        <Toast tone={by === "you" ? "sonar" : "neutral"} icon={by === "you" ? "target" : "warning"} onClose={onClose}>
            {sunkText(shipName, by, opponentName)}
        </Toast>
    );
}
