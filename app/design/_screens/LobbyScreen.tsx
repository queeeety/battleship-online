"use client";

import { useState } from "react";
import { LobbyCode, PlayerChip } from "@/components/game";
import { Icon } from "@/components/ui";
import { SampleStates, SCREEN, ScreenBar, ShowcaseStrip, useCopyToast } from "./chrome";

type Stage = "waiting" | "joined";

const CODE = "K7Q2XM";
const LINK = `mybattleship.app/j/${CODE}`;

export function LobbyScreen() {
  const [stage, setStage] = useState<Stage>("waiting");
  const { copy, toastNode } = useCopyToast();
  const joined = stage === "joined";

  return (
    <>
      <ShowcaseStrip name="Lobby screen">
        <SampleStates
          label="Sample state"
          value={stage}
          onChange={setStage}
          options={[
            { value: "waiting", label: "Waiting" },
            { value: "joined", label: "Opponent joined" },
          ]}
        />
      </ShowcaseStrip>
      <div className={SCREEN}>
        <ScreenBar>
          <span className="mb-label hidden min-[600px]:inline">Original · 15 s turns</span>
        </ScreenBar>
        <main className="mx-auto grid w-full max-w-[880px] content-start gap-(--space-6) px-(--space-4) pt-(--space-5) pb-(--space-6) min-[900px]:grid-cols-2 min-[900px]:px-(--space-6)">
          <div className="grid content-start gap-(--space-4)">
            <div className="grid gap-(--space-1)">
              <h1 className="text-title">{joined ? "Teddy joined" : "Invite an opponent"}</h1>
              {/* the top bar hides the game type on phones, so it sits under the title there */}
              <span className="mb-label min-[600px]:hidden">Original · 15 s turns</span>
            </div>
            <LobbyCode
              code={CODE}
              link={LINK}
              waiting={!joined}
              onCopyCode={() => copy(CODE, "Lobby code copied.")}
              onCopyLink={() => copy(`https://${LINK}`, "Link copied.")}
            />
          </div>
          <div className="grid content-start gap-(--space-3) min-[900px]:pt-(--space-5)">
            <span className="mb-label">Players · {joined ? 2 : 1} of 2</span>
            <PlayerChip name="Tim" you host />
            {joined ? (
              <PlayerChip name="Teddy" />
            ) : (
              // the guest's seat before anyone joins: dashed, like an empty ability slot
              <div className="mb-player border-dashed border-line-control bg-transparent">
                <span className="mb-player-icon">
                  <Icon name="player" size={20} />
                </span>
                <span className="mb-player-body text-ink-muted">Open seat</span>
              </div>
            )}
          </div>
        </main>
      </div>
      {toastNode}
    </>
  );
}
