"use client";

import { useEffect, useState, useTransition, type ReactNode } from "react";
import { TurnTimer, type ShotLogEntry } from "@/components/game";
import { MuteToggle } from "@/components/feedback/MuteToggle";
import { abilityIdFromName } from "@/components/game/data";
import { SunkMessage } from "@/components/feedback/SunkMessage";
import { Banner, Toast } from "@/components/ui";
import { useAbilityTargeting } from "@/hooks/useAbilityTargeting";
import { useGraceClaim } from "@/hooks/useGraceClaim";
import { useTurnClock } from "@/hooks/useTurnClock";
import type { WirePrivatePayload } from "@/lib/boundary/NetworkHandler";
import { TURN_TIME_LIMIT_SECONDS } from "@/lib/config";
import type { PlayerView } from "@/lib/controllers/Server";
import { GameState } from "@/lib/enums";
import type { BattleFailure } from "@/lib/server/actions/battle";
import { AwayBanner } from "./AwayBanner";
import type { BattleActions } from "./battleActions";
import { BattleView } from "./BattleView";
import {
  abilityLogEntry,
  boardProps,
  newLogEntries,
  ownBoardState,
  shipName,
  sunkNotice,
  targetBoardState,
  type SunkNotice,
} from "./fromPlayerView";

const NOTICE_MS = 4000;

interface BattleStageProps {
  view: PlayerView;
  actions: BattleActions;
  /** Left of the bar's buttons, e.g. "Original · Lobby K7Q2XM". */
  barLabel: string;
  opponentKind?: "human" | "ai";
  /** A fresh object per message. */
  lastPrivate: { payload: WirePrivatePayload } | null;
  refresh: () => void;
  onFailure: (error: BattleFailure) => void;
  /** An error toast, stacked with the battle's own. */
  failure?: ReactNode;
}

export function BattleStage({
  view,
  actions,
  barLabel,
  opponentKind = "human",
  lastPrivate,
  refresh,
  onFailure,
  failure,
}: BattleStageProps) {
  const opponentName = view.opponent?.name ?? "Opponent";
  const own = ownBoardState(view);
  const target = targetBoardState(view);
  const total = TURN_TIME_LIMIT_SECONDS[view.gameType];
  const live = view.gameState === GameState.IN_PROGRESS;
  // the game just ended; the screen holds a moment before the result (useEndHold)
  const won = view.gameState === GameState.FINISHED ? view.result?.won ?? view.winner === view.seat : null;
  const theirs = opponentKind === "ai" ? "ai" : "opponent";

  const [log, setLog] = useState<ShotLogEntry[]>([]);

  // before the view, so an ability that lands with the shots it led to is logged first
  const [seenPrivate, setSeenPrivate] = useState(lastPrivate);
  const [heads, setHeads] = useState<string | null>(null);
  // bumped when the opponent reroutes a ship, which may now sit on squares scanned as empty
  const [reroutes, setReroutes] = useState(0);
  if (seenPrivate !== lastPrivate) {
    setSeenPrivate(lastPrivate);
    const payload = lastPrivate?.payload;
    if (payload?.kind === "abilityUsed") {
      setLog((l) => [...l, abilityLogEntry("opponent", payload.ability, l.length + 1)]);
      setHeads(`${payload.by} used ${payload.ability}.`);
      if (payload.ability === "Reroute") setReroutes((n) => n + 1);
    }
  }

  // worked out while rendering, so a new view and its notice show up in the same paint
  const [seen, setSeen] = useState(view);
  const [notice, setNotice] = useState<SunkNotice | null>(null);
  // an ability just handed to you (one of your ships sank): a toast, and the card glows until used
  const [gift, setGift] = useState<string | null>(null);
  const [fresh, setFresh] = useState<string | null>(null);
  if (seen !== view) {
    setSeen(view);
    setLog((l) => [...l, ...newLogEntries(seen, view, l.length)]);
    const sunk = sunkNotice(seen, view);
    if (sunk) setNotice(sunk);
    if (view.heldAbility && !seen.heldAbility) {
      setGift(view.heldAbility);
      setFresh(view.heldAbility);
    }
  }

  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(null), NOTICE_MS);
    return () => clearTimeout(id);
  }, [notice]);

  useEffect(() => {
    if (!heads) return;
    const id = setTimeout(() => setHeads(null), NOTICE_MS);
    return () => clearTimeout(id);
  }, [heads]);

  useEffect(() => {
    if (!gift) return;
    const id = setTimeout(() => setGift(null), NOTICE_MS + 2000);
    return () => clearTimeout(id);
  }, [gift]);

  // a shot or an ability on its way: the board waits until the next view arrives
  const [pending, setPending] = useState<{ key: string | null; view: PlayerView } | null>(null);
  const waiting = pending?.view === view;
  const pendingKey = waiting ? pending.key : null;
  const canAct = view.yourTurn && !waiting;

  function fire(cell: { x: number; y: number; key: string }) {
    if (!canAct) return;
    setPending({ key: cell.key, view });
    void actions.fireShot({ row: cell.y, col: cell.x }).then((result) => {
      if (result.ok) {
        // in case the broadcast never arrives
        refresh();
      } else {
        setPending(null);
        onFailure(result.error);
      }
    });
  }

  const ability = useAbilityTargeting({
    heldAbility: view.heldAbility,
    offeredAbility: view.offeredAbility,
    yourTurn: canAct,
    doubleShotActive: view.doubleShotActive,
    yourBoard: view.yourBoard,
    yourShots: view.yourShots.map(({ row, col }) => ({ row, col })),
    revealedSquares: view.revealedSquares,
    scanReset: reroutes,
    onUse: async (request, square) => {
      setPending({ key: null, view });
      const result = await actions.useAbility(request, square);
      if (!result.ok) {
        setPending(null);
        onFailure(result.error);
        return false;
      }
      setLog((l) => [...l, abilityLogEntry("you", request.name, l.length + 1, square)]);
      refresh();
      return true;
    },
    onChoose: async (keep) => {
      const result = await actions.chooseAbility(keep);
      if (!result.ok) onFailure(result.error);
      return result.ok;
    },
  });

  if (fresh !== null && (fresh !== view.heldAbility || ability.card.state === "armed")) setFresh(null);

  // the server pauses the clock only while the player to move is away
  const opponentAwaySince = view.opponent && !view.opponent.connected ? view.opponent.disconnectedAt : null;
  const pausedAt = view.yourTurn ? null : opponentAwaySince;
  const seconds = useTurnClock({
    total,
    turnStartedAt: view.turnStartedAt,
    pausedAt,
    live,
    claim: actions.claimTimeout,
    onStuck: refresh,
  });
  const graceLeft = useGraceClaim(opponentAwaySince, actions.claimTimeout);

  const [forfeitOpen, setForfeitOpen] = useState(false);
  const [forfeiting, startForfeit] = useTransition();
  function confirmForfeit() {
    startForfeit(async () => {
      const result = await actions.forfeit();
      if (!result.ok) onFailure(result.error);
      setForfeitOpen(false);
    });
  }

  return (
    <BattleView
      barLabel={barLabel}
      barExtra={<MuteToggle />}
      opponentName={opponentName}
      target={{
        ...boardProps(target),
        marks: { ...ability.scanMarks, ...target.marks },
        active: canAct,
        sweeping: canAct,
        lastShot: target.lastShot,
        highlight: pendingKey ? { keys: [pendingKey], valid: true } : undefined,
        onCellClick: fire,
        ...ability.targetBoardProps,
      }}
      own={{
        ...boardProps(own),
        ships: [...own.ships, ...ability.ownGhost],
        lastShot: own.lastShot,
        ...ability.ownBoardProps,
      }}
      // once it's over, the indicator stays on whoever fired the last shot
      turn={won !== null ? (won ? "you" : theirs) : view.yourTurn ? "you" : theirs}
      renderClock={(size) => (
        <TurnTimer
          seconds={seconds}
          total={total}
          paused={!!pausedAt}
          pausedReason="Paused · opponent away"
          size={size}
        />
      )}
      ability={{ card: { ...ability.card, fresh: fresh !== null }, hint: ability.hint }}
      log={log}
      notice={
        won !== null ? (
          <Banner tone="info" icon={won ? "check" : "warning"}>
            {won ? `You sank ${opponentName}'s whole fleet.` : `${opponentName} sank your whole fleet.`}
          </Banner>
        ) : (
          graceLeft !== null && <AwayBanner name={opponentName} secondsLeft={graceLeft} />
        )
      }
      toasts={
        <>
          {failure}
          {notice ? (
            <SunkMessage
              shipName={shipName(notice.ship)}
              by={notice.by}
              opponentName={opponentName}
              onClose={() => setNotice(null)}
            />
          ) : (
            heads && (
              <Toast icon="info" onClose={() => setHeads(null)}>
                {heads}
              </Toast>
            )
          )}
          {gift && (
            <Toast icon={abilityIdFromName(gift) ?? "info"} onClose={() => setGift(null)}>
              You got {gift}! It&apos;s in your ability card, ready for your turn.
            </Toast>
          )}
        </>
      }
      offer={ability.offer}
      forfeit={{
        open: forfeitOpen,
        onOpen: () => setForfeitOpen(true),
        onClose: () => setForfeitOpen(false),
        onConfirm: confirmForfeit,
        busy: forfeiting,
      }}
    />
  );
}
