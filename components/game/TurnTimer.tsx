import { cx } from "@/components/ui/cx";

export interface TurnTimerProps {
  /** Seconds left, from the server; don't count locally. */
  seconds: number;
  /** Turn limit for the game type: 30 Beginner, 15 Original, 5 Quick Fire. */
  total: number;
  paused?: boolean;
  /** Text shown while paused. */
  pausedReason?: string;
  size?: "lg" | "sm";
}

export function TurnTimer({ seconds, total, paused, pausedReason = "Paused · opponent away", size = "lg" }: TurnTimerProps) {
  // the last third of the turn turns amber: the server fires a random shot at zero
  const low = !paused && seconds <= Math.ceil(total / 3);
  const fraction = Math.max(0, Math.min(1, seconds / total));
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(Math.floor(seconds % 60)).padStart(2, "0");

  return (
    <div className={cx("mb-timer", `is-${size}`, low && "is-low", paused && "is-paused")}>
      <div className="mb-timer-top">
        <span className="mb-label">{paused ? pausedReason : low ? "Auto-fire at 0" : "Time left"}</span>
        <span className="mb-timer-read" role="timer" aria-label={`${seconds} seconds left`}>
          {mm}:{ss}
        </span>
      </div>
      <div className="mb-timer-track" aria-hidden>
        <div className="mb-timer-fill" style={{ transform: `scaleX(${fraction})` }} />
      </div>
    </div>
  );
}
