import type { CSSProperties, ReactNode } from "react";
import { cx } from "@/components/ui/cx";
import { SHIPS, type ShipType } from "./data";

export interface ShipProps {
  type: ShipType;
  orientation?: "horizontal" | "vertical";
  /** Damage shows as hit marks on the board; only sunk recolours the ship. */
  status?: "intact" | "damaged" | "sunk";
  /** Outline of a ship being placed or rerouted, at a valid or invalid spot. */
  ghost?: "valid" | "invalid";
}

// drawn horizontally on a 100-unit-per-cell grid, W units long
function hullPath(type: ShipType, W: number): string {
  switch (type) {
    case "carrier":
      return `M8 24H${W - 34}L${W - 8} 40V76H8Z`;
    case "submarine":
      return `M34 32H${W - 44}Q${W - 8} 32 ${W - 8} 50Q${W - 8} 68 ${W - 44} 68H34Q8 68 8 50Q8 32 34 32Z`;
    case "destroyer":
      return `M12 30H${W - 56}C${W - 28} 30 ${W - 12} 42 ${W - 6} 50C${W - 12} 58 ${W - 28} 70 ${W - 56} 70H12Q6 70 6 64V36Q6 30 12 30Z`;
    default:
      return `M12 24H${W - 62}C${W - 30} 24 ${W - 12} 40 ${W - 6} 50C${W - 12} 60 ${W - 30} 76 ${W - 62} 76H12Q6 76 6 70V30Q6 24 12 24Z`;
  }
}

function deck(type: ShipType, W: number): ReactNode {
  const k = "mb-ship-deck";
  switch (type) {
    case "carrier":
      return (
        <>
          <path className={k} d={`M26 50H${W - 60}`} strokeDasharray="10 10" />
          <rect className={k} x={W * 0.62} y={28} width={44} height={12} rx={2} />
        </>
      );
    case "battleship":
      return (
        <>
          <circle className={k} cx={W * 0.24} cy={50} r={11} />
          <rect className={k} x={W * 0.42} y={40} width={50} height={20} rx={2} />
          <circle className={k} cx={W * 0.7} cy={50} r={11} />
        </>
      );
    case "cruiser":
      return (
        <>
          <circle className={k} cx={W * 0.3} cy={50} r={10} />
          <rect className={k} x={W * 0.5} y={41} width={40} height={18} rx={2} />
        </>
      );
    case "submarine":
      return <rect className={k} x={W / 2 - 24} y={43} width={48} height={14} rx={7} />;
    default:
      return <rect className={k} x={W * 0.32} y={43} width={34} height={14} rx={2} />;
  }
}

export function Ship({ type, orientation = "horizontal", status = "intact", ghost }: ShipProps) {
  const { name, length } = SHIPS[type];
  const W = length * 100;
  const vertical = orientation === "vertical";

  return (
    <svg
      className={cx(
        "mb-ship",
        `is-${status}`,
        ghost && `is-ghost-${ghost}`,
        vertical ? "is-v" : "is-h",
      )}
      viewBox={vertical ? `0 0 100 ${W}` : `0 0 ${W} 100`}
      style={{ "--mb-len": length } as CSSProperties}
      role="img"
      aria-label={name + (status === "sunk" ? ", sunk" : status === "damaged" ? ", damaged" : "")}
    >
      <g transform={vertical ? "translate(100 0) rotate(90)" : undefined}>
        <path className="mb-ship-hull" d={hullPath(type, W)} />
        {deck(type, W)}
      </g>
    </svg>
  );
}
