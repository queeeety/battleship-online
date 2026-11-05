"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import { Banner, Button, SegmentedControl } from "@/components/ui";
import { SCREEN, ScreenBar } from "./chrome";
import { GAME_TYPE_OPTIONS, type GameTypeName } from "./gameTypes";

export type DifficultyName = "EASY" | "NORMAL";

// how each level plays, from AIOpponent
const DIFFICULTY_OPTIONS = [
  { value: "EASY", label: "Easy", meta: "Fires at random" },
  { value: "NORMAL", label: "Normal", meta: "Hunts down hits" },
];

export interface AiSetupViewProps {
  difficulty: DifficultyName;
  onDifficultyChange: (difficulty: DifficultyName) => void;
  gameType: GameTypeName;
  onGameTypeChange: (type: GameTypeName) => void;
  onStart: () => void;
  /** An unfinished game to go back to, e.g. "Normal · Original". */
  resume?: { label: string; onResume: () => void } | null;
}

export function AiSetupView({ difficulty, onDifficultyChange, gameType, onGameTypeChange, onStart, resume }: AiSetupViewProps) {
  function submit(e: FormEvent) {
    e.preventDefault();
    onStart();
  }

  return (
    <div className={SCREEN}>
      <ScreenBar homeHref="/" />
      <main className="mx-auto grid w-full max-w-[880px] content-start px-(--space-4) pt-(--space-5) pb-(--space-6) min-[900px]:px-(--space-6)">
        <form className="grid w-full max-w-md content-start gap-(--space-4) justify-self-center" onSubmit={submit}>
          {resume && (
            <Banner
              tone="info"
              icon="ai"
              action={
                <Button size="sm" onClick={resume.onResume}>
                  Continue
                </Button>
              }
            >
              You have an unfinished game ({resume.label}).
            </Banner>
          )}
          <div className="grid gap-(--space-1)">
            <span className="mb-label">Solo</span>
            <h1 className="text-display">Play the computer.</h1>
          </div>
          <SegmentedControl
            label="Difficulty"
            value={difficulty}
            onChange={(v) => onDifficultyChange(v as DifficultyName)}
            options={DIFFICULTY_OPTIONS}
          />
          <SegmentedControl
            label="Game type"
            value={gameType}
            onChange={(v) => onGameTypeChange(v as GameTypeName)}
            options={GAME_TYPE_OPTIONS}
          />
          <Button type="submit" variant="primary" icon="ai">
            Start game
          </Button>
          <Link href="/" className="mb-label justify-self-start hover:text-ink">
            Back to home
          </Link>
        </form>
      </main>
    </div>
  );
}
