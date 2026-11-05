"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ErrorToast } from "@/components/feedback/ErrorToast";
import { isToastFailure } from "@/components/feedback/ErrorState";
import { AiSetupView, type DifficultyName } from "@/components/screens/AiSetupView";
import { BattleStage } from "@/components/screens/BattleStage";
import { boardProps, finalEnemyBoardState, ownBoardState, resultSummary } from "@/components/screens/fromPlayerView";
import { gameTypeName, type GameTypeName } from "@/components/screens/gameTypes";
import { PlacementView } from "@/components/screens/PlacementView";
import { readyLabel, type Layout } from "@/components/screens/placement";
import { ResultView } from "@/components/screens/ResultView";
import { screenFor } from "@/components/screens/screenFor";
import { useGameSounds } from "@/hooks/useGameSounds";
import { useScreenFocus } from "@/hooks/useScreenFocus";
import { useLocalGame } from "@/hooks/useLocalGame";
import { usePlacement } from "@/hooks/usePlacement";
import type { PlayerView } from "@/lib/controllers/Server";
import { Difficulty, GameType } from "@/lib/enums";
import type { BattleFailure } from "@/lib/server/actions/battle";

const COMPUTER = { name: "Computer", ready: true, ai: true };

function LocalPlacement({ onReady, onLeave }: { onReady: (layout: Layout) => void; onLeave: () => void }) {
  const placement = usePlacement();
  return (
    <PlacementView
      {...placement.editor}
      ready={{
        label: readyLabel(placement.left),
        disabled: !placement.complete,
        onClick: () => onReady(placement.layout),
      }}
      opponent={COMPUTER}
      onLeave={onLeave}
    />
  );
}

function barLabel(view: PlayerView, difficulty: Difficulty | null): string {
  const level = difficulty === Difficulty.EASY ? "Easy" : "Normal";
  return `${gameTypeName(view.gameType)} · vs Computer (${level})`;
}

export function LocalGameClient() {
  const router = useRouter();
  const local = useLocalGame();
  const { view } = local;
  const [difficulty, setDifficulty] = useState<DifficultyName>("NORMAL");
  const [gameType, setGameType] = useState<GameTypeName>("ORIGINAL");
  const [failure, setFailure] = useState<BattleFailure | null>(null);

  useGameSounds(view);
  const screen = view ? screenFor({ view, notSeated: false, wasSeated: true }) : "setup";
  useScreenFocus(screen);

  function leave() {
    local.quit();
    router.push("/");
  }

  if (!view) {
    return (
      <AiSetupView
        difficulty={difficulty}
        onDifficultyChange={setDifficulty}
        gameType={gameType}
        onGameTypeChange={setGameType}
        onStart={() => local.start(Difficulty[difficulty], GameType[gameType])}
      />
    );
  }

  if (screen === "placement") {
    return <LocalPlacement onReady={(layout) => local.ready(layout)} onLeave={leave} />;
  }

  if (screen === "result") {
    return (
      <ResultView
        barLabel={barLabel(view, local.difficulty)}
        summary={resultSummary(view)}
        rematch={{ status: "none", opponentName: "Computer", onRequest: local.playAgain, onHome: leave }}
        enemy={boardProps(finalEnemyBoardState(view))}
        own={boardProps(ownBoardState(view))}
      />
    );
  }

  return (
    <BattleStage
      view={view}
      actions={local.actions}
      barLabel={barLabel(view, local.difficulty)}
      opponentKind="ai"
      lastPrivate={local.lastPrivate}
      refresh={() => {}}
      onFailure={setFailure}
      failure={failure && isToastFailure(failure) && <ErrorToast error={failure} onClose={() => setFailure(null)} />}
    />
  );
}
