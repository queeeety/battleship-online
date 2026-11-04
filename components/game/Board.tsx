"use client";

import { useId, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { HitEffect } from "@/components/effects/HitEffect";
import { MissEffect } from "@/components/effects/MissEffect";
import { SinkEffect } from "@/components/effects/SinkEffect";
import { cx } from "@/components/ui/cx";
import { nextPosition } from "@/hooks/useGridKeyboardNav";
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
  /** Squares an armed ability would cover; valid=false draws them as a target the server would refuse. */
  highlight?: { keys: string[]; valid: boolean };
  /** Picking a square for an ability, not firing: squares already shot stay pickable, and the own board takes clicks. */
  targeting?: boolean;
  onCellClick?: (cell: { x: number; y: number; key: string }) => void;
  /** The square under the pointer or the keyboard cursor; null when it leaves the board. */
  onCellHover?: (cell: { x: number; y: number; key: string } | null) => void;
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

type ShotMark = "hit" | "miss" | "sunk";

function isShot(mark: CellMark | undefined): mark is ShotMark {
  return mark === "hit" || mark === "miss" || mark === "sunk";
}

// the newest shot's mark plays its effect once; older marks are static
const SHOT_EFFECT = { hit: HitEffect, miss: MissEffect, sunk: SinkEffect } as const;

function MarkIcon({ mark }: { mark: CellMark | undefined }) {
  if (mark === "miss") return <span className="mb-mk-miss" />;
  if (mark === "hit" || mark === "sunk") {
    return (
      <svg className="mb-mk-x" viewBox="0 0 20 20">
        <path d="M5 5l10 10M15 5L5 15" />
      </svg>
    );
  }
  if (mark === "contact") return <span className="mb-mk-contact" />;
  return null;
}

function ShotEffect({ mark }: { mark: ShotMark }) {
  const Effect = SHOT_EFFECT[mark];
  return (
    <Effect active className="mb-mk-fx">
      <MarkIcon mark={mark} />
    </Effect>
  );
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
  highlight,
  targeting,
  onCellClick,
  onCellHover,
}: BoardProps) {
  const idPrefix = useId();
  const [cursor, setCursor] = useState({ x: 0, y: 0 });
  const lines = Array.from({ length: size }, (_, i) => i);
  const interactive = !!active && (variant === "target" || !!targeting);
  const highlighted = new Set(highlight?.keys);

  // a cell already fired at can't be fired at again, so a repeat shot is never sent
  function fire(x: number, y: number) {
    const key = coordKey(x, y);
    if (targeting || !isShot(marks[key])) onCellClick?.({ x, y, key });
  }

  function hover(cell: { x: number; y: number } | null) {
    onCellHover?.(cell && { ...cell, key: coordKey(cell.x, cell.y) });
  }

  // the grid is one Tab stop (Safari's default Tab skips buttons); arrows, Home/End and PageUp/PageDown
  // move the cursor (shared with useGridKeyboardNav), Enter or Space fires
  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const next = nextPosition(e.key, e.ctrlKey || e.metaKey, cursor, size);
    if (next) {
      e.preventDefault();
      setCursor(next);
      hover(next);
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
          onFocus={interactive ? () => hover(cursor) : undefined}
          onBlur={interactive ? () => hover(null) : undefined}
          onMouseLeave={interactive ? () => hover(null) : undefined}
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
                  const inHighlight = highlighted.has(key);
                  return (
                    <div
                      key={key}
                      id={`${idPrefix}${key}`}
                      role="gridcell"
                      className={cx(
                        "mb-cell",
                        mark && `is-${mark}`,
                        interactive && cursor.x === x && cursor.y === y && "is-cursor",
                        inHighlight && (highlight?.valid ? "is-preview" : "is-preview-invalid"),
                      )}
                      aria-label={
                        key +
                        (mark ? `, ${MARK_LABEL[mark]}` : "") +
                        (inHighlight ? (highlight?.valid ? ", in target area" : ", target not allowed") : "")
                      }
                      aria-disabled={interactive && !targeting && isShot(mark) ? true : undefined}
                      onMouseEnter={interactive ? () => hover({ x, y }) : undefined}
                      onClick={
                        interactive
                          ? () => {
                              setCursor({ x, y });
                              fire(x, y);
                            }
                          : undefined
                      }
                    >
                      {key === lastShot && isShot(mark) ? (
                        <ShotEffect mark={mark} />
                      ) : (
                        <MarkIcon mark={mark} />
                      )}
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
