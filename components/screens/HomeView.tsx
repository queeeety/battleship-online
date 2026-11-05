"use client";

import type { FormEvent, ReactNode } from "react";
import { Button, SegmentedControl, TextField } from "@/components/ui";
import { LOBBY_CODE_LENGTH, PLAYER_NAME_MAX_LENGTH } from "@/lib/config";
import { SCREEN, ScreenBar } from "./chrome";
import { GAME_TYPE_OPTIONS, type GameTypeName } from "./gameTypes";

// panels from 900px; below that the other ways in are plain sections under a hairline, so Create lobby leads
const SIDE_PANEL =
  "grid content-start gap-(--space-3) min-[900px]:rounded-md min-[900px]:border min-[900px]:border-line min-[900px]:bg-surface-100 min-[900px]:p-(--space-4)";

export interface HomeViewProps {
  name: string;
  onNameChange: (name: string) => void;
  gameType: GameTypeName;
  onGameTypeChange: (type: GameTypeName) => void;
  code: string;
  onCodeChange: (code: string) => void;
  /** Which request is on its way; both buttons wait while one is. */
  pending?: "create" | "join" | null;
  nameError?: string;
  codeError?: string;
  onCreate: () => void;
  onJoin: () => void;
  onPlayAi: () => void;
  /** Above the form, e.g. the rejoin banner. */
  notice?: ReactNode;
}

export function HomeView({
  name,
  onNameChange,
  gameType,
  onGameTypeChange,
  code,
  onCodeChange,
  pending = null,
  nameError,
  codeError,
  onCreate,
  onJoin,
  onPlayAi,
  notice,
}: HomeViewProps) {
  const busy = pending !== null;

  function submit(action: () => void) {
    return (e: FormEvent) => {
      e.preventDefault();
      if (!busy) action();
    };
  }

  return (
    <div className={SCREEN}>
      <ScreenBar />
      <main className="mx-auto grid w-full max-w-[880px] content-start gap-(--space-6) px-(--space-4) pt-(--space-5) pb-(--space-6) min-[900px]:grid-cols-2 min-[900px]:px-(--space-6)">
        {/* no box of its own, so an empty or still-streaming notice leaves no gap */}
        {notice && <div className="contents *:min-[900px]:col-span-2">{notice}</div>}
        <form className="grid content-start gap-(--space-4)" onSubmit={submit(onCreate)}>
          <span className="mb-label max-[899px]:hidden">Multiplayer</span>
          <h1 className="text-display">Find an opponent.</h1>
          <TextField
            label="Display name"
            placeholder="Player123"
            hint="Optional. Blank becomes Player + 3 digits."
            maxLength={PLAYER_NAME_MAX_LENGTH}
            value={name}
            onChange={onNameChange}
            error={nameError}
          />
          <SegmentedControl
            label="Game type"
            value={gameType}
            onChange={(v) => onGameTypeChange(v as GameTypeName)}
            options={GAME_TYPE_OPTIONS}
          />
          <Button type="submit" variant="primary" disabled={busy} aria-busy={pending === "create"}>
            {pending === "create" ? "Creating lobby…" : "Create lobby"}
          </Button>
        </form>
        <div className="grid content-start gap-(--space-5) max-[899px]:border-t max-[899px]:border-line max-[899px]:pt-(--space-5) min-[900px]:gap-(--space-4) min-[900px]:pt-(--space-5)">
          <form className={SIDE_PANEL} onSubmit={submit(onJoin)}>
            <span className="mb-label max-[899px]:hidden">Have a code?</span>
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-(--space-2) min-[900px]:grid-cols-1 min-[900px]:gap-(--space-3)">
              <TextField
                label="Lobby code"
                code
                maxLength={LOBBY_CODE_LENGTH}
                value={code}
                onChange={onCodeChange}
                error={codeError}
              />
              <Button type="submit" disabled={busy} aria-busy={pending === "join"}>
                {pending === "join" ? "Joining…" : "Join lobby"}
              </Button>
            </div>
          </form>
          <section className={SIDE_PANEL}>
            <span className="mb-label max-[899px]:hidden">Solo</span>
            <Button icon="ai" disabled={busy} onClick={onPlayAi}>
              Play vs AI
            </Button>
          </section>
        </div>
      </main>
    </div>
  );
}
