"use client";

import type { ReactNode } from "react";
import { Board, FleetStatus, PlayerChip, type FleetEntry, type ShipPlacement, type ShipType } from "@/components/game";
import type { BoardProps } from "@/components/game/Board";
import { Banner, Button, Icon } from "@/components/ui";
import { SCREEN, ScreenBar } from "./chrome";

export interface PlacementViewProps {
  /** Spread onto your board: the ships, and while editing the ghost and the clicks. */
  board: Partial<BoardProps> & { ships: ShipPlacement[] };
  fleet: FleetEntry[];
  selected?: ShipType | null;
  /** Left out once the fleet is locked in. */
  onSelect?: (type: ShipType) => void;
  onRotate?: () => void;
  onRandomise?: () => void;
  error?: string | null;
  ready: { label: string; disabled?: boolean; busy?: boolean; onClick?: () => void };
  opponent?: { name: string; ready: boolean; presence?: "online" | "away" | "offline"; ai?: boolean } | null;
  title?: string;
  /** Above the board, e.g. "Teddy lost connection". */
  notice?: ReactNode;
  onLeave?: () => void;
}

export function PlacementView({
  board,
  fleet,
  selected,
  onSelect,
  onRotate,
  onRandomise,
  error,
  ready,
  opponent,
  title = "Place your fleet",
  notice,
  onLeave,
}: PlacementViewProps) {
  const editing = !!onSelect;
  const tray = <FleetStatus mode="placement" selected={selected ?? undefined} onSelect={onSelect} fleet={fleet} />;
  const readyButton = (
    <Button variant="primary" block disabled={ready.disabled} aria-busy={ready.busy} onClick={ready.onClick}>
      {ready.label}
    </Button>
  );

  return (
    <div className={SCREEN}>
      <ScreenBar>
        {opponent && (
          <>
            <span className="mb-label min-[600px]:hidden">
              {opponent.name} · {opponent.ready ? "Ready" : "Placing"}
            </span>
            <div className="max-[599px]:hidden">
              <PlayerChip name={opponent.name} ready={opponent.ready} presence={opponent.presence} ai={opponent.ai} />
            </div>
          </>
        )}
        {onLeave && (
          <Button size="sm" variant="ghost" onClick={onLeave}>
            Leave
          </Button>
        )}
      </ScreenBar>
      <main className="grid content-start gap-(--space-6) px-(--space-4) pt-(--space-4) min-[900px]:grid-cols-[auto_300px] min-[900px]:px-(--space-6) min-[900px]:pt-(--space-5) min-[900px]:pb-(--space-6)">
        <div className="grid content-start gap-(--space-4)">
          <h1 className="text-title">{title}</h1>
          {notice}
          {/* phones: pick a ship right above the board you place it on */}
          <div className="min-[900px]:hidden">{tray}</div>
          <div className="max-[480px]:justify-self-center">
            <Board variant="own" cellSize="lg" {...board} />
          </div>
          {/* phones: a quiet line under the board, with its height kept so nothing jumps */}
          <p className="mb-field-msg min-h-[18px] text-danger min-[900px]:hidden" role="alert">
            {error && (
              <>
                <Icon name="warning" size={16} />
                {error}
              </>
            )}
          </p>
          {error && (
            <div className="max-[899px]:hidden">
              <Banner tone="danger" icon="warning">
                {error}
              </Banner>
            </div>
          )}
        </div>

        {/* tablets and desktop: the fleet and the actions beside the board */}
        <div className="grid content-start gap-(--space-3) max-[899px]:hidden min-[900px]:pt-[46px]">
          {tray}
          {editing && (
            <div className="mb-row">
              <Button size="sm" icon="rotate" onClick={onRotate}>
                Rotate (R)
              </Button>
              <Button size="sm" icon="shuffle" onClick={onRandomise}>
                Randomise
              </Button>
            </div>
          )}
          {readyButton}
        </div>

        {/* phones: the actions stay in reach at the bottom of the screen */}
        <div className="sticky bottom-0 -mx-(--space-4) flex items-center gap-(--space-2) border-t border-line bg-surface-000 px-(--space-4) pt-(--space-3) pb-[max(var(--space-3),env(safe-area-inset-bottom))] min-[900px]:hidden">
          {editing && (
            <>
              <Button icon="rotate" iconOnly onClick={onRotate}>
                Rotate
              </Button>
              <Button icon="shuffle" iconOnly onClick={onRandomise}>
                Randomise
              </Button>
            </>
          )}
          <div className="flex-1">{readyButton}</div>
        </div>
      </main>
    </div>
  );
}
