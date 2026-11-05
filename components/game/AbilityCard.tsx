import { Button } from "@/components/ui/Button";
import { cx } from "@/components/ui/cx";
import { Icon } from "@/components/ui/Icon";
import { ABILITIES, type AbilityId } from "./data";

export interface AbilityCardProps {
  /** null = empty slot. */
  ability: AbilityId | null;
  /**
   * ready: usable now. armed: chosen, waiting for a target on the board.
   * unavailable: not your turn or no valid target. new: just drawn.
   */
  state?: "ready" | "armed" | "unavailable" | "new";
  onUse?: () => void;
  onCancel?: () => void;
  /** While armed, e.g. Line Scan's row or column, or turning the rerouted ship. */
  turn?: { label: string; onTurn: () => void };
  /** Just received: the card glows and says so until it's used. */
  fresh?: boolean;
  /** No description. The Use/Cancel button moves into the head row, and only shows when onUse or onCancel is given. */
  compact?: boolean;
}

export function AbilityCard({ ability, state = "ready", onUse, onCancel, turn, fresh, compact }: AbilityCardProps) {
  if (!ability) {
    return (
      <div className="mb-ability is-empty">
        <span className="mb-label">Ability</span>
        <p className="mb-ability-desc">None held. You draw one when one of your ships is sunk.</p>
      </div>
    );
  }

  const { name, description, usesTurnShot } = ABILITIES[ability];
  const action =
    state === "armed" ? (
      <>
        {turn && (
          <Button size="sm" icon="rotate" onClick={turn.onTurn}>
            {turn.label}
          </Button>
        )}
        <Button size="sm" variant="ghost" icon="close" onClick={onCancel}>
          Cancel
        </Button>
      </>
    ) : (
      <Button size="sm" disabled={state === "unavailable"} onClick={onUse}>
        Use {name}
      </Button>
    );

  return (
    <div className={cx("mb-ability", `is-${state}`, fresh && state !== "armed" && "is-fresh", compact && "is-compact")}>
      <div className="mb-ability-head">
        <span className="mb-ability-icon">
          <Icon name={ability} size={24} />
        </span>
        <div>
          <span className="mb-label">
            {state === "armed"
              ? "Armed · pick a target"
              : `${fresh ? "New · " : ""}${usesTurnShot ? "Uses your shot" : "Extra shot"}`}
          </span>
          <h4 className="mb-ability-name">{name}</h4>
        </div>
        {compact && (onUse || onCancel) && <div className="mb-ability-inline">{action}</div>}
      </div>
      {!compact && <p className="mb-ability-desc">{description}</p>}
      {!compact && <div className="mb-ability-actions">{action}</div>}
    </div>
  );
}
