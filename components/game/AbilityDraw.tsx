import { Button } from "@/components/ui/Button";
import { AbilityCard } from "./AbilityCard";
import { ABILITIES, type AbilityId } from "./data";

export interface AbilityDrawProps {
  current: AbilityId;
  drawn: AbilityId;
  onKeep?: () => void;
  onReplace?: () => void;
}

// keep-or-replace when a second ability is drawn; show it inside a Dialog
export function AbilityDraw({ current, drawn, onKeep, onReplace }: AbilityDrawProps) {
  return (
    <div className="mb-draw">
      <p className="mb-draw-lead">You can hold one ability. Keep yours or take the new one.</p>
      <div className="mb-draw-pair">
        <div>
          <span className="mb-label">Holding</span>
          <AbilityCard ability={current} compact />
        </div>
        <div>
          <span className="mb-label">Drawn</span>
          <AbilityCard ability={drawn} compact state="new" />
        </div>
      </div>
      <div className="mb-row mb-row-end">
        <Button onClick={onKeep}>Keep {ABILITIES[current].name}</Button>
        <Button variant="primary" onClick={onReplace}>
          Take {ABILITIES[drawn].name}
        </Button>
      </div>
    </div>
  );
}
