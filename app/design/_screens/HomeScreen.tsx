"use client";

import { useState } from "react";
import { Button, SegmentedControl, TextField } from "@/components/ui";
import { LOBBY_CODE_LENGTH, PLAYER_NAME_MAX_LENGTH, TURN_TIME_LIMIT_SECONDS } from "@/lib/config";
import { GameType } from "@/lib/enums";
import { PANEL, SCREEN, ScreenBar } from "./chrome";

const GAME_TYPES = [
  { value: "BEGINNER", label: "Beginner", meta: `${TURN_TIME_LIMIT_SECONDS[GameType.BEGINNER]} s turns` },
  { value: "ORIGINAL", label: "Original", meta: `${TURN_TIME_LIMIT_SECONDS[GameType.ORIGINAL]} s turns` },
  { value: "QUICK_FIRE", label: "Quick Fire", meta: `${TURN_TIME_LIMIT_SECONDS[GameType.QUICK_FIRE]} s turns` },
];

export function HomeScreen() {
  const [gameType, setGameType] = useState("ORIGINAL");

  return (
    <div className={SCREEN}>
      <ScreenBar />
      <main className="grid w-full max-w-[880px] content-start gap-(--space-6) px-(--space-4) pt-(--space-5) pb-(--space-6) min-[900px]:grid-cols-2 min-[900px]:px-(--space-6)">
        <div className="grid content-start gap-(--space-4)">
          <span className="mb-label">Multiplayer</span>
          <h1 className="text-display">Find an opponent.</h1>
          <TextField
            label="Display name"
            placeholder="Player123"
            hint="Optional. Blank becomes Player + 3 digits."
            maxLength={PLAYER_NAME_MAX_LENGTH}
          />
          <SegmentedControl label="Game type" value={gameType} onChange={setGameType} options={GAME_TYPES} />
          <Button variant="primary">Create lobby</Button>
        </div>
        <div className="grid content-start gap-(--space-4) min-[900px]:pt-(--space-5)">
          <section className={PANEL}>
            <span className="mb-label">Have a code?</span>
            <TextField label="Lobby code" code maxLength={LOBBY_CODE_LENGTH} placeholder="K7Q2XM" />
            <Button>Join lobby</Button>
          </section>
          <section className={PANEL}>
            <span className="mb-label">Solo</span>
            <Button icon="ai">Play vs AI</Button>
          </section>
        </div>
      </main>
    </div>
  );
}
