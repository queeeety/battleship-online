import { FLEET_SIZE } from "@/lib/entities/ships/fleet";
import type { EndReasonName } from "./data";

export interface ResultSummaryProps {
  didWin: boolean;
  reason: EndReasonName;
  shotsFired: number;
  /** 0 to 1. */
  accuracy: number;
  shipsSunk: number;
}

// [winner's text, loser's text]
const REASON: Record<EndReasonName, [string, string]> = {
  FLEET_DESTROYED: ["Enemy fleet destroyed.", "Your fleet was destroyed."],
  OPPONENT_FORFEIT: ["Your opponent forfeited.", "You forfeited."],
  OPPONENT_DISCONNECTED: ["Your opponent disconnected.", "You were disconnected for too long."],
};

export function ResultSummary({ didWin, reason, shotsFired, accuracy, shipsSunk }: ResultSummaryProps) {
  const stats: Array<[string, string]> = [
    ["Shots fired", String(shotsFired)],
    ["Accuracy", `${Math.round(accuracy * 100)}%`],
    ["Ships sunk", `${shipsSunk} / ${FLEET_SIZE}`],
  ];

  return (
    <section className={`mb-result ${didWin ? "is-win" : "is-loss"}`}>
      <span className="mb-label">Result</span>
      <h2 className="mb-result-head">{didWin ? "Victory" : "Defeat"}</h2>
      <p className="mb-result-reason">{REASON[reason][didWin ? 0 : 1]}</p>
      <dl className="mb-stats">
        {stats.map(([label, value]) => (
          <div key={label}>
            <dt className="mb-label">{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
