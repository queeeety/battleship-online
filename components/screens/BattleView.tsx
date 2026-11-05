"use client";

import type { ReactNode } from "react";
import { AbilityCard, AbilityDraw, Board, Legend, ShotLog, TurnIndicator, type ShotLogEntry } from "@/components/game";
import type { AbilityCardProps } from "@/components/game/AbilityCard";
import type { AbilityDrawProps } from "@/components/game/AbilityDraw";
import type { BoardProps } from "@/components/game/Board";
import { Button, Dialog } from "@/components/ui";
import { SCREEN, ScreenBar } from "./chrome";

export interface BattleViewProps {
  /** Left of the bar's buttons, e.g. "Original · Lobby K7Q2XM". */
  barLabel: string;
  /** More items in the bar, before Forfeit. */
  barExtra?: ReactNode;
  opponentName: string;
  /** Enemy waters: marks, ships, clicks; spread after the defaults. */
  target: Partial<BoardProps>;
  /** Your waters. */
  own: Partial<BoardProps>;
  turn: "you" | "opponent" | "ai";
  turnNumber?: number;
  /** The turn timer at either size; called twice, so the caller decides which copy acts on expiry. */
  renderClock: (size: "lg" | "sm") => ReactNode;
  ability: { card: AbilityCardProps; hint: string | null };
  log: ShotLogEntry[];
  /** Above the boards, e.g. "Teddy lost connection". */
  notice?: ReactNode;
  /** Inside the toast dock: sunk notices and the like. */
  toasts?: ReactNode;
  /** Over everything, e.g. the start countdown. */
  overlay?: ReactNode;
  /** The keep-or-replace prompt; null when there's nothing to answer. */
  offer: AbilityDrawProps & { onKeep: () => void } | null;
  forfeit: { open: boolean; onOpen: () => void; onClose: () => void; onConfirm: () => void; busy?: boolean };
}

export function BattleView({
  barLabel,
  barExtra,
  opponentName,
  target,
  own,
  turn,
  turnNumber,
  renderClock,
  ability,
  log,
  notice,
  toasts,
  overlay,
  offer,
  forfeit,
}: BattleViewProps) {
  return (
    <div className={SCREEN}>
      <ScreenBar>
        <span className="mb-label hidden min-[600px]:inline">{barLabel}</span>
        {barExtra}
        <Button size="sm" variant="danger" icon="flag" onClick={forfeit.onOpen}>
          Forfeit
        </Button>
      </ScreenBar>

      {/* phones: target board, the HUD strip, then your board. 900-1199px: both boards on one row,
          the HUD as three panels underneath. 1200px+: boards and the HUD column side by side.
          mb-battle scales the boards with the window (components.css) */}
      <main className="mb-battle flex flex-col gap-(--space-5) px-(--space-4) pt-(--space-4) pb-(--space-6) min-[900px]:grid min-[900px]:grid-cols-[auto_auto] min-[900px]:items-start min-[900px]:justify-center min-[900px]:gap-(--space-6) min-[900px]:pt-(--space-5) min-[1200px]:grid-cols-[auto_auto_var(--hud-width)] min-[1200px]:px-(--space-6)">
        <h1 className="sr-only">Battle against {opponentName}</h1>
        {notice && <div className="order-first min-[900px]:col-span-full">{notice}</div>}
        <div className="mb-board-centred order-1 max-[899px]:self-center min-[900px]:order-none">
          <Board variant="target" title="Enemy waters" cellSize="lg" {...target} />
        </div>
        <div className="mb-board-centred order-3 grid content-start gap-(--space-3) max-[899px]:justify-items-center min-[900px]:order-none">
          <Board variant="own" title="Your waters" cellSize="sm" {...own} />
          <div className="max-[899px]:hidden">
            <Legend />
          </div>
        </div>

        {/* phones: everything needed on your turn in one strip, right under the board you fire at */}
        <section className="mb-strip order-2 min-[900px]:hidden" aria-label="Turn">
          <div className="flex items-center gap-(--space-3)">
            <TurnIndicator turn={turn} opponentName={opponentName} />
            <div className="min-w-0 flex-1">{renderClock("sm")}</div>
          </div>
          <AbilityCard {...ability.card} compact />
          {ability.hint && <p className="mb-ability-hint" role="status">{ability.hint}</p>}
          <ShotLog opponentLabel={opponentName} entries={log.slice(-1)} />
        </section>

        {/* tablets: a row of three panels under the boards; desktop: the HUD column on the right */}
        <div className="order-2 grid content-start gap-(--space-3) max-[899px]:hidden min-[900px]:order-none min-[900px]:max-[1199px]:col-span-2 min-[900px]:max-[1199px]:grid-cols-3">
          <div className="grid content-start gap-(--space-3)">
            <TurnIndicator turn={turn} turnNumber={turnNumber} opponentName={opponentName} />
            {renderClock("lg")}
          </div>
          <div className="grid content-start gap-(--space-2)">
            <AbilityCard {...ability.card} />
            {ability.hint && <p className="mb-ability-hint" role="status">{ability.hint}</p>}
          </div>
          <ShotLog opponentLabel={opponentName} maxHeight={120} entries={log} />
        </div>

        {/* phones: the full log and the key to the marks, folded away under your board */}
        <details className="order-4 min-[900px]:hidden">
          <summary className="mb-label cursor-pointer py-(--space-2)">Shot log and key</summary>
          <div className="grid gap-(--space-3) pt-(--space-2)">
            <ShotLog opponentLabel={opponentName} maxHeight={160} entries={log} />
            <Legend />
          </div>
        </details>
      </main>

      {overlay}

      <div className="mb-toast-dock">{toasts}</div>

      {/* dismissing keeps what you hold, as the server does when an offer goes unanswered */}
      <Dialog open={!!offer} title="You drew an ability" onClose={offer?.onKeep}>
        {offer && <AbilityDraw {...offer} />}
      </Dialog>

      <Dialog
        open={forfeit.open}
        title="Forfeit this game?"
        onClose={forfeit.onClose}
        actions={
          <>
            <Button onClick={forfeit.onClose}>Keep playing</Button>
            <Button variant="danger" icon="flag" disabled={forfeit.busy} onClick={forfeit.onConfirm}>
              {forfeit.busy ? "Forfeiting…" : "Forfeit"}
            </Button>
          </>
        }
      >
        <p>{opponentName} wins and the result is recorded. You can still ask for a rematch.</p>
      </Dialog>
    </div>
  );
}
