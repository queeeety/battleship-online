"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import {
  boardProps,
  finalEnemyBoardState,
  ownBoardState,
  rematchState,
  resultSummary,
} from "@/components/screens/fromPlayerView";
import { gameTypeName } from "@/components/screens/gameTypes";
import { ResultView } from "@/components/screens/ResultView";
import { Banner } from "@/components/ui";
import { settle } from "@/utils/settle";
import type { PlayerView } from "@/lib/controllers/Server";
import { requestRematch, type BattleFailure } from "@/lib/server/actions/battle";

interface ResultStageProps {
  code: string;
  view: PlayerView;
  opponentHere: boolean;
  /** In case the broadcast after an answer never arrives. */
  refresh: () => void;
  onFailure: (error: BattleFailure) => void;
}

// whoever says no (Decline or Home) leaves at once, so only the other player sees "declined"
export function ResultStage({ code, view, opponentHere, refresh, onFailure }: ResultStageProps) {
  const router = useRouter();
  const [busy, startBusy] = useTransition();
  const opponentName = view.opponent?.name ?? "Opponent";
  const status = rematchState(view);

  function answer(yes: boolean, thenHome: boolean) {
    if (busy) return;
    startBusy(async () => {
      const result = await settle(() => requestRematch(code, yes));
      // leaving goes ahead even if the no didn't land, e.g. the other player accepted first
      if (thenHome) router.push("/");
      else if (!result.ok) onFailure(result.error);
      else refresh();
    });
  }

  function home() {
    // decline on the way out, so the other player isn't left waiting
    if (status === "none" || status === "requested-by-you" || status === "requested-by-opponent") answer(false, true);
    else router.push("/");
  }

  return (
    <ResultView
      barLabel={`${gameTypeName(view.gameType)} · Lobby ${code}`}
      summary={resultSummary(view)}
      rematch={{
        status,
        opponentName,
        onRequest: () => answer(true, false),
        onAccept: () => answer(true, false),
        onDecline: () => answer(false, true),
        onHome: home,
        disabled: busy || !opponentHere,
      }}
      enemy={boardProps(finalEnemyBoardState(view))}
      own={boardProps(ownBoardState(view))}
      notice={
        !opponentHere &&
        status !== "declined" && (
          <Banner tone="info" icon="offline">
            {opponentName} left the game, so a rematch can&apos;t start.
          </Banner>
        )
      }
    />
  );
}
