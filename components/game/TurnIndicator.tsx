export interface TurnIndicatorProps {
  turn: "you" | "opponent" | "ai";
  turnNumber?: number;
  opponentName?: string;
}

export function TurnIndicator({ turn, turnNumber, opponentName = "Opponent" }: TurnIndicatorProps) {
  const text = turn === "you" ? "Your turn" : turn === "ai" ? "AI is aiming" : `${opponentName}’s turn`;

  return (
    <div className={`mb-turn is-${turn}`} role="status" aria-live="polite">
      <span className="mb-turn-dot" aria-hidden />
      <span className="mb-turn-text">{text}</span>
      {turnNumber != null && (
        <span className="mb-label mb-turn-n">Turn {String(turnNumber).padStart(2, "0")}</span>
      )}
    </div>
  );
}
