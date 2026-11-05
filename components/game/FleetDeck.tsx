"use client";

import type { PointerEvent } from "react";
import { cx } from "@/components/ui/cx";
import { Icon } from "@/components/ui/Icon";
import { SHIPS, type ShipType } from "./data";
import { Ship } from "./Ship";

export interface DeckShip {
  type: ShipType;
  placed: boolean;
}

export interface FleetDeckProps {
  ships: DeckShip[];
  /** The ship being dragged out of the deck, drawn faded in its slot. */
  lifted?: ShipType | null;
  /** Picked with the keyboard, to place with the board's arrow keys and Enter. */
  selected?: ShipType | null;
  /** Starts dragging a ship; left out once the fleet is locked in. */
  onGrab?: (type: ShipType, e: PointerEvent<HTMLButtonElement>) => void;
  onSelect?: (type: ShipType) => void;
}

// the ships still to place, ready to drag onto the board
export function FleetDeck({ ships, lifted, selected, onGrab, onSelect }: FleetDeckProps) {
  const placed = ships.filter((s) => s.placed).length;

  return (
    <div className="mb-fleet mb-deck">
      <div className="mb-fleet-head">
        <span className="mb-label">Fleet</span>
        <span className="mb-label">
          {placed} / {ships.length} placed
        </span>
      </div>
      <ul>
        {ships.map(({ type, placed }) => {
          const { name, length } = SHIPS[type];
          const row = (
            <>
              <span className="mb-deck-ship" aria-hidden>
                <Ship type={type} />
              </span>
              <span className="mb-deck-name">{name}</span>
              <span className="mb-deck-state">{placed ? <Icon name="check" size={16} label="on the board" /> : length}</span>
            </>
          );
          return (
            <li
              key={type}
              className={cx("mb-deck-item", placed && "is-placed", lifted === type && "is-lifted", selected === type && "is-selected")}
            >
              {onGrab && !placed ? (
                // the whole row is the handle, not just the ship
                <button
                  type="button"
                  className="mb-deck-row mb-deck-grab"
                  aria-label={`${name}, ${length} squares`}
                  aria-pressed={selected === type}
                  onPointerDown={(e) => onGrab(type, e)}
                  // only a keyboard press (detail 0) picks it; a pointer drags it instead
                  onClick={(e) => {
                    if (e.detail === 0) onSelect?.(type);
                  }}
                >
                  {row}
                </button>
              ) : (
                <div className="mb-deck-row">{row}</div>
              )}
            </li>
          );
        })}
      </ul>
      {onGrab && (
        <p className="mb-deck-hint">Drag ships onto the board. Tap or click a placed ship to turn it.</p>
      )}
    </div>
  );
}
