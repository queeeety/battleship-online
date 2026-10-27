import type { ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";

export type RematchState = "none" | "requested-by-you" | "requested-by-opponent" | "accepted" | "declined";

export interface RematchPanelProps {
  /** Against the AI, skip the request states: Rematch starts a new game at once. */
  status: RematchState;
  opponentName?: string;
  onRequest?: () => void;
  onAccept?: () => void;
  onDecline?: () => void;
  onHome?: () => void;
}

export function RematchPanel({
  status,
  opponentName = "Opponent",
  onRequest,
  onAccept,
  onDecline,
  onHome,
}: RematchPanelProps) {
  const home = (
    <Button variant="ghost" icon="arrow-left" onClick={onHome}>
      Home
    </Button>
  );
  let message: ReactNode = null;
  let actions: ReactNode = null;

  switch (status) {
    case "requested-by-you":
      message = (
        <>
          <span className="mb-pulse" aria-hidden />
          Rematch requested. Waiting for {opponentName}.
        </>
      );
      actions = home;
      break;
    case "requested-by-opponent":
      message = `${opponentName} wants a rematch.`;
      actions = (
        <>
          {home}
          <Button onClick={onDecline}>Decline</Button>
          <Button variant="primary" onClick={onAccept}>
            Accept
          </Button>
        </>
      );
      break;
    case "accepted":
      message = (
        <>
          <Icon name="check" size={16} />
          Rematch on. Same lobby, new boards.
        </>
      );
      break;
    case "declined":
      message = `${opponentName} declined the rematch.`;
      actions = (
        <Button variant="primary" icon="arrow-left" onClick={onHome}>
          Home
        </Button>
      );
      break;
    default:
      actions = (
        <>
          {home}
          <Button variant="primary" icon="rotate" onClick={onRequest}>
            Rematch
          </Button>
        </>
      );
  }

  return (
    <div className={`mb-rematch is-${status}`}>
      {message && (
        <p className="mb-rematch-msg" role="status">
          {message}
        </p>
      )}
      {actions && <div className="mb-row mb-row-end">{actions}</div>}
    </div>
  );
}
