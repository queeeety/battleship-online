"use client";

import { useEffect, useRef } from "react";
import { cx } from "@/components/ui/cx";
import { ABILITIES, SHIPS, type AbilityId, type ShipType } from "./data";

export interface ShotLogEntry {
  turn: number;
  by: "you" | "opponent";
  coord?: string;
  result?: "miss" | "hit" | "sunk";
  ship?: ShipType;
  ability?: AbilityId;
  note?: string;
}

export interface ShotLogProps {
  /** Oldest first. */
  entries: ShotLogEntry[];
  opponentLabel?: string;
  maxHeight?: number;
}

function resultText(e: ShotLogEntry): string {
  if (e.note) return e.note;
  if (e.result === "sunk") return `Sunk ${e.ship ? SHIPS[e.ship].name : ""}`;
  return e.result ?? "";
}

export function ShotLog({ entries, opponentLabel = "Them", maxHeight = 220 }: ShotLogProps) {
  const listRef = useRef<HTMLOListElement>(null);

  // keep the newest entry in view
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [entries.length]);

  return (
    <div className="mb-log">
      <span className="mb-label">Log</span>
      <ol ref={listRef} style={{ maxHeight }} aria-live="polite">
        {entries.map((e, i) => (
          <li key={i} className={cx("mb-log-row", e.by === "you" ? "is-you" : "is-them")}>
            <span className="mb-log-n">{String(e.turn).padStart(2, "0")}</span>
            <span className="mb-log-who">{e.by === "you" ? "You" : opponentLabel}</span>
            <span className="mb-log-what">
              {e.ability ? ABILITIES[e.ability].name + (e.coord ? ` ${e.coord}` : "") : e.coord}
            </span>
            <span className={cx("mb-log-res", e.result && `is-${e.result}`)}>{resultText(e)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
