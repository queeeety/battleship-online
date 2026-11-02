import { cx } from "@/components/ui/cx";
import type { CellMark } from "./data";

type LegendItem = CellMark | "ship";

export interface LegendProps {
  items?: LegendItem[];
}

const TEXT: Record<LegendItem, string> = {
  ship: "Your ship",
  hit: "Hit",
  miss: "Miss",
  sunk: "Sunk",
  contact: "Contact",
  clear: "Scanned, clear",
};

export function Legend({ items = ["ship", "hit", "miss", "sunk", "contact"] }: LegendProps) {
  return (
    <ul className="mb-legend">
      {items.map((item) => (
        <li key={item}>
          <span className={cx("mb-legend-swatch", "mb-cell", `is-${item}`)}>
            {item === "miss" && <span className="mb-mk-miss" />}
            {(item === "hit" || item === "sunk") && (
              <svg className="mb-mk-x" viewBox="0 0 20 20">
                <path d="M5 5l10 10M15 5L5 15" />
              </svg>
            )}
            {item === "contact" && <span className="mb-mk-contact" />}
          </span>
          {TEXT[item]}
        </li>
      ))}
    </ul>
  );
}
