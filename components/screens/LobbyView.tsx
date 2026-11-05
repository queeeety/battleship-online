"use client";

import Link from "next/link";
import { LobbyCode, PlayerChip } from "@/components/game";
import { Icon } from "@/components/ui";
import { SCREEN, ScreenBar, useCopyToast } from "./chrome";

export interface LobbyViewProps {
  code: string;
  /** The share link as shown, without the protocol. */
  link: string;
  /** The share link as copied. */
  href: string;
  /** "Original · 15 s turns" */
  typeLabel: string;
  youName: string;
  /** Null while the guest's seat is open. */
  opponentName: string | null;
  /** Shows a Leave link in the bar. */
  leaveHref?: string;
}

export function LobbyView({ code, link, href, typeLabel, youName, opponentName, leaveHref }: LobbyViewProps) {
  const { copy, toastNode } = useCopyToast();
  const joined = opponentName !== null;

  return (
    <>
      <div className={SCREEN}>
        <ScreenBar homeHref={leaveHref}>
          <span className="mb-label hidden min-[600px]:inline">{typeLabel}</span>
          {leaveHref && (
            <Link href={leaveHref} className="mb-btn mb-btn-ghost mb-btn-sm">
              Leave
            </Link>
          )}
        </ScreenBar>
        <main className="mx-auto grid w-full max-w-[880px] content-start gap-(--space-6) px-(--space-4) pt-(--space-5) pb-(--space-6) min-[900px]:grid-cols-2 min-[900px]:px-(--space-6)">
          <div className="grid content-start gap-(--space-4)">
            <div className="grid gap-(--space-1)">
              <h1 className="text-title">{joined ? `${opponentName} joined` : "Invite an opponent"}</h1>
              {/* the top bar hides the game type on phones, so it sits under the title there */}
              <span className="mb-label min-[600px]:hidden">{typeLabel}</span>
            </div>
            <LobbyCode
              code={code}
              link={link}
              waiting={!joined}
              onCopyCode={() => copy(code, "Lobby code copied.")}
              onCopyLink={() => copy(href, "Link copied.")}
            />
          </div>
          <div className="grid content-start gap-(--space-3) min-[900px]:pt-(--space-5)">
            <span className="mb-label">Players · {joined ? 2 : 1} of 2</span>
            <PlayerChip name={youName} you host />
            {joined ? (
              <PlayerChip name={opponentName} />
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
