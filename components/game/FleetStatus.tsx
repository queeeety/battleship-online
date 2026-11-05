"use client";

import { cx } from "@/components/ui/cx";
import { Icon } from "@/components/ui/Icon";
import { SHIPS, type ShipType } from "./data";

export interface FleetEntry {
  type: ShipType;
  hits?: number;
  sunk?: boolean;
  placed?: boolean;
}

export interface FleetStatusProps {
  /** battle: hits and sunk. placement: placed or not; one may be selected. */
  mode?: "battle" | "placement";
  fleet: FleetEntry[];
  selected?: ShipType;
  /** Placement only: the rows become buttons. */
  onSelect?: (type: ShipType) => void;
}

export function FleetStatus({ mode = "battle", fleet, selected, onSelect }: FleetStatusProps) {
  const afloat = fleet.filter((f) => !f.sunk).length;
  const placed = fleet.filter((f) => f.placed).length;

  return (
    <div className={cx("mb-fleet", `is-${mode}`)}>
      <div className="mb-fleet-head">
        <span className="mb-label">{mode === "placement" ? "Fleet" : "Fleet status"}</span>
        <span className="mb-label">
          {mode === "placement" ? `${placed} / ${fleet.length} placed` : `${afloat} / ${fleet.length} afloat`}
        </span>
      </div>
      <ul>
        {fleet.map((f) => {
          const { name, length } = SHIPS[f.type];
          const hits = f.sunk ? length : (f.hits ?? 0);
          const row = (
            <>
              <span className="mb-fleet-name">{name}</span>
              <span className="mb-pips" aria-hidden>
                {Array.from({ length }, (_, i) => (
                  <i
                    key={i}
                    className={cx(
                      mode === "battle" && i < hits && (f.sunk ? "is-sunk" : "is-hit"),
                      mode === "placement" && f.placed && "is-placed",
                    )}
                  />
                ))}
              </span>
              <span className="mb-fleet-state">
                {mode === "placement"
                  ? f.placed
                    ? <Icon name="check" size={16} label="placed" />
                    : length
                  : f.sunk
                    ? "Sunk"
                    : hits
                      ? `${hits} hit`
                      : ""}
              </span>
            </>
          );
          const className = cx(
            "mb-fleet-row",
            f.sunk && "is-sunk",
            f.placed && "is-placed",
            selected === f.type && "is-selected",
          );

          return (
            <li key={f.type}>
              {onSelect && mode === "placement" ? (
                <button
                  type="button"
                  className={className}
                  aria-pressed={selected === f.type}
                  onClick={() => onSelect(f.type)}
                >
                  {row}
                </button>
              ) : (
                <div className={className}>{row}</div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
