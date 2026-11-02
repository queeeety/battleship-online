"use client";

import { useId, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { cx } from "@/components/ui/cx";
import { BOARD_SIZE } from "@/lib/config";
import { coordKey, type CellMark, type ShipType } from "./data";
import { Ship } from "./Ship";

export interface ShipPlacement {
  type: ShipType;
  /** Zero-based column of the stern (left/top end). */
  x: number;
  /** Zero-based row of the stern. */
  y: number;
  orientation: "horizontal" | "vertical";
  status?: "intact" | "damaged" | "sunk";
  ghost?: "valid" | "invalid";
}

export interface BoardProps {
  /** own = your fleet. target = enemy waters you fire at. */
  variant: "own" | "target";
  title?: string;
  /** Right side of the header, e.g. "3 of 5 afloat". */
  meta?: ReactNode;
  /** Marks keyed by coordinate, e.g. { E5: "hit", B2: "miss" }. */
  marks?: Record<string, CellMark>;
  /** On the target board, enemy ships only once sunk. */
  ships?: ShipPlacement[];
  /** Target board on your turn: cells can be fired at, sonar frame. */
  active?: boolean;
  /** Sonar sweep (target board, your turn). */
  sweeping?: boolean;
  /** Dashed outline of the area an ability scanned or is about to scan, in cells. */
  scanArea?: { x: number; y: number; w: number; h: number };
  /** Coordinate of the most recent shot: plays the ping ring. */
  lastShot?: string;
  cellSize?: "sm" | "md" | "lg";
  size?: number;
  onCellClick?: (cell: { x: number; y: number; key: string }) => void;
}

const MARK_LABEL: Record<CellMark, string> = {
  miss: "miss",
  hit: "hit",
  sunk: "sunk",
  contact: "contact",
  clear: "scanned, clear",
};

function vars(values: Record<string, number>): CSSProperties {
  return Object.fromEntries(Object.entries(values).map(([k, v]) => [`--mb-${k}`, v])) as CSSProperties;
}

function isShot(mark: CellMark | undefined): boolean {
  return mark === "hit" || mark === "miss" || mark === "sunk";
}

// the board only draws what it's given; the game state lives with the caller
export function Board({
  variant,
  title,
  meta,
  marks = {},
  ships = [],
  active,
  sweeping,
  scanArea,
  lastShot,
  cellSize = "md",
  size = BOARD_SIZE,
  onCellClick,
}: BoardProps) {
  const idPrefix = useId();
  const [cursor, setCursor] = useState({ x: 0, y: 0 });
  const lines = Array.from({ length: size }, (_, i) => i);
  const interactive = variant === "target" && active;

  // a cell already fired at can't be fired at again, so a repeat shot is never sent
  function fire(x: number, y: number) {
    const key = coordKey(x, y);
    if (!isShot(marks[key])) onCellClick?.({ x, y, key });
  }

  // the grid is one Tab stop (Safari's default Tab skips buttons); arrows move the cursor, Enter or Space fires
  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const last = size - 1;
    const moves: Record<string, { x: number; y: number }> = {
      ArrowLeft: { x: Math.max(0, cursor.x - 1), y: cursor.y },
      ArrowRight: { x: Math.min(last, cursor.x + 1), y: cursor.y },
      ArrowUp: { x: cursor.x, y: Math.max(0, cursor.y - 1) },
      ArrowDown: { x: cursor.x, y: Math.min(last, cursor.y + 1) },
      Home: { x: 0, y: cursor.y },
      End: { x: last, y: cursor.y },
    };
    if (moves[e.key]) {
      e.preventDefault();
      setCursor(moves[e.key]);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      fire(cursor.x, cursor.y);
    }
  }

  return (
    <section
      className={cx("mb-board", `is-${variant}`, `is-cell-${cellSize}`, active && "is-active")}
      style={vars({ n: size })}
    >
      {(title || meta) && (
        <header className="mb-board-head">
          {title && <h3 className="mb-board-title">{title}</h3>}
          {meta && <span className="mb-board-meta">{meta}</span>}
        </header>
      )}
      <div className="mb-board-frame">
        <div className="mb-board-corner" aria-hidden />
        <div className="mb-board-cols" aria-hidden>
          {lines.map((i) => (
            <span key={i}>{String.fromCharCode(65 + i)}</span>
          ))}
        </div>
        <div className="mb-board-rows" aria-hidden>
          {lines.map((i) => (
            <span key={i}>{i + 1}</span>
          ))}
        </div>
        <div
          className="mb-board-sea"
          role="grid"
          aria-label={title || (variant === "own" ? "Your waters" : "Enemy waters")}
          tabIndex={interactive ? 0 : undefined}
          aria-activedescendant={interactive ? `${idPrefix}${coordKey(cursor.x, cursor.y)}` : undefined}
          onKeyDown={interactive ? onKeyDown : undefined}
        >
          {sweeping && <div className="mb-sweep" aria-hidden />}
          <div className="mb-board-ships">
            {ships.map((s) => (
              <div key={`${s.type}-${s.x}-${s.y}`} className="mb-ship-slot" style={vars({ x: s.x, y: s.y })}>
                <Ship type={s.type} orientation={s.orientation} status={s.status} ghost={s.ghost} />
              </div>
            ))}
          </div>
          {scanArea && <div className="mb-scan" aria-hidden style={vars(scanArea)} />}
          <div className="mb-board-cells">
            {lines.map((y) => (
              <div key={y} role="row" className="mb-board-row">
                {lines.map((x) => {
                  const key = coordKey(x, y);
                  const mark = marks[key];
                  return (
                    <div
                      key={key}
                      id={`${idPrefix}${key}`}
                      role="gridcell"
                      className={cx(
                        "mb-cell",
                        mark && `is-${mark}`,
                        interactive && cursor.x === x && cursor.y === y && "is-cursor",
                      )}
                      aria-label={key + (mark ? `, ${MARK_LABEL[mark]}` : "")}
                      aria-disabled={interactive && isShot(mark) ? true : undefined}
                      onClick={
                        interactive
                          ? () => {
                              setCursor({ x, y });
                              fire(x, y);
                            }
                          : undefined
                      }
                    >
                      {mark === "miss" && <span className="mb-mk-miss" />}
                      {(mark === "hit" || mark === "sunk") && (
                        <svg className="mb-mk-x" viewBox="0 0 20 20">
                          <path d="M5 5l10 10M15 5L5 15" />
                        </svg>
                      )}
                      {mark === "contact" && <span className="mb-mk-contact" />}
                      {key === lastShot && <span className="mb-mk-ping" />}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
