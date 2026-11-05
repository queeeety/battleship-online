"use client";

import { useState, type ReactNode } from "react";
import { Board, RematchPanel, ResultSummary, type RematchPanelProps, type ResultSummaryProps } from "@/components/game";
import type { BoardProps } from "@/components/game/Board";
import { SegmentedControl } from "@/components/ui";
import { SCREEN, ScreenBar } from "./chrome";

type BoardTab = "enemy" | "own";

export interface ResultViewProps {
  barLabel: string;
  /** Null while the server's result is on its way. */
  summary: ResultSummaryProps | null;
  rematch: RematchPanelProps;
  /** Enemy waters as the game ended. */
  enemy: Partial<BoardProps>;
  /** Your waters as the game ended. */
  own: Partial<BoardProps>;
  /** Above the panel, e.g. "Teddy left". */
  notice?: ReactNode;
}

export function ResultView({ barLabel, summary, rematch, enemy, own, notice }: ResultViewProps) {
  const [boardTab, setBoardTab] = useState<BoardTab>("enemy");

  return (
    <div className={SCREEN}>
      <ScreenBar>
        <span className="mb-label hidden min-[600px]:inline">{barLabel}</span>
      </ScreenBar>
      <main className="grid content-start justify-items-center gap-(--space-6) px-(--space-4) pt-(--space-5) pb-(--space-6) min-[900px]:px-(--space-6)">
        <h1 className="sr-only">Game over</h1>
        <div className="grid w-full max-w-[460px] gap-(--space-4)">
          {notice}
          {summary && <ResultSummary {...summary} />}
          <RematchPanel {...rematch} />
        </div>
        <section className="grid w-fit max-w-full gap-(--space-3)" aria-label="Final boards">
          <span className="mb-label max-[899px]:hidden">Final boards</span>
          {/* phones: one board at a time */}
          <div className="min-[900px]:hidden">
            <SegmentedControl
              label="Final boards"
              value={boardTab}
              onChange={(v) => setBoardTab(v as BoardTab)}
              options={[
                { value: "enemy", label: "Enemy waters" },
                { value: "own", label: "Your waters" },
              ]}
            />
          </div>
          <div className="flex flex-wrap items-start justify-center gap-(--space-6)">
            <div className={boardTab === "enemy" ? undefined : "max-[899px]:hidden"}>
              <Board variant="target" title="Enemy waters" {...enemy} />
            </div>
            <div className={boardTab === "own" ? undefined : "max-[899px]:hidden"}>
              <Board variant="own" title="Your waters" {...own} />
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
