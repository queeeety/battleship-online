"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button, Dialog } from "@/components/ui";
import { AwayBanner } from "@/components/screens/AwayBanner";
import { PlacementView } from "@/components/screens/PlacementView";
import { FLEET_ORDER, readyLabel, toShipPlacements } from "@/components/screens/placement";
import { useGraceClaim } from "@/hooks/useGraceClaim";
import { usePlacement } from "@/hooks/usePlacement";
import { settle } from "@/utils/settle";
import type { PlayerView } from "@/lib/controllers/Server";
import { claimTimeout, forfeit, placeShips, type BattleFailure } from "@/lib/server/actions/battle";

interface PlacementStageProps {
  code: string;
  view: PlayerView;
  /** In case the broadcast after Ready never arrives. */
  refresh: () => void;
  onFailure: (error: BattleFailure) => void;
}

export function PlacementStage({ code, view, refresh, onFailure }: PlacementStageProps) {
  const router = useRouter();
  const [sending, startSending] = useTransition();
  const [sent, setSent] = useState(false);
  const placement = usePlacement([], { keys: !sent && !view.you.ready });
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [leaving, startLeaving] = useTransition();

  const opponent = view.opponent;
  const opponentName = opponent?.name ?? "your opponent";
  const graceLeft = useGraceClaim(opponent && !opponent.connected ? opponent.disconnectedAt : null, () =>
    settle(() => claimTimeout(code)),
  );

  function ready() {
    startSending(async () => {
      const result = await settle(() => placeShips(code, { ships: placement.layout }));
      if (result.ok) {
        setSent(true);
        refresh();
      } else {
        onFailure(result.error);
      }
    });
  }

  function leave() {
    startLeaving(async () => {
      const result = await settle(() => forfeit(code));
      if (result.ok) router.push("/");
      else onFailure(result.error);
    });
  }

  const notice = graceLeft !== null && <AwayBanner name={opponentName} secondsLeft={graceLeft} />;

  const shared = {
    opponent: opponent && {
      name: opponent.name,
      ready: opponent.ready,
      presence: opponent.connected ? ("online" as const) : ("away" as const),
    },
    notice,
    onLeave: () => setLeaveOpen(true),
  };

  // the server's copy once it arrives, ours until then
  const locked = view.you.ready ? view.yourBoard.ships : sent ? placement.layout : null;

  return (
    <>
      {locked ? (
        <PlacementView
          {...shared}
          title="Fleet ready"
          board={{ ships: toShipPlacements(locked) }}
          fleet={FLEET_ORDER.map((type) => ({ type, placed: true }))}
          ready={{ label: `Waiting for ${opponentName}…`, disabled: true }}
        />
      ) : (
        <PlacementView
          {...shared}
          {...placement.editor}
          ready={{
            label: sending ? "Sending…" : readyLabel(placement.left),
            disabled: !placement.complete || sending,
            busy: sending,
            onClick: ready,
          }}
        />
      )}
      <Dialog
        open={leaveOpen}
        title="Leave this game?"
        onClose={() => setLeaveOpen(false)}
        actions={
          <>
            <Button onClick={() => setLeaveOpen(false)}>Keep playing</Button>
            <Button variant="danger" icon="flag" disabled={leaving} onClick={leave}>
              {leaving ? "Leaving…" : "Leave"}
            </Button>
          </>
        }
      >
        <p>{opponentName} wins and the game ends.</p>
      </Dialog>
    </>
  );
}
