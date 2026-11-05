"use client";

import type { CSSProperties, HTMLAttributes, ReactNode, Ref } from "react";
import { Board, FleetDeck, PlayerChip, Ship, type FleetDeckProps, type ShipPlacement, type ShipType } from "@/components/game";
import type { BoardProps } from "@/components/game/Board";
import { Banner, Button, Icon } from "@/components/ui";
import { cx } from "@/components/ui/cx";
import { SCREEN, ScreenBar } from "./chrome";

export interface PlacementViewProps {
  /** Spread onto your board: the ships, and while editing the ghost, the halo and the keyboard. */
  board: Partial<BoardProps> & { ships: ShipPlacement[] };
  /** Spread onto the area around the board while editing: dragging placed ships starts here. */
  boardArea?: HTMLAttributes<HTMLDivElement> & { ref?: Ref<HTMLDivElement> };
  deck: FleetDeckProps;
  /** The ship being dragged while it's off the board, drawn under the pointer. */
  drag?: { type: ShipType; heading: "horizontal" | "vertical"; left: number; top: number; cell: number } | null;
  /** Left out once the fleet is locked in. */
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
  boardArea,
  deck,
  drag,
  onRandomise,
  error,
  ready,
  opponent,
  title = "Place your fleet",
  notice,
  onLeave,
}: PlacementViewProps) {
  const editing = !!onRandomise;
  const tray = <FleetDeck {...deck} />;
  const readyButton = (
    <Button variant="primary" block disabled={ready.disabled} aria-busy={ready.busy} onClick={ready.onClick}>
      {ready.label}
    </Button>
  );

  return (
    // nothing here is text to copy, and dragging ships shouldn't select any (or open the iOS callout)
    <div className={`${SCREEN} select-none [-webkit-touch-callout:none]`}>
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
      <main className="grid content-start gap-(--space-6) px-(--space-4) pt-(--space-4) min-[900px]:grid-cols-[auto_300px] min-[900px]:justify-center min-[900px]:px-(--space-6) min-[900px]:pt-(--space-5) min-[900px]:pb-(--space-6)">
        <div className="grid content-start gap-(--space-4)">
          <h1 className="text-title">{title}</h1>
          {notice}
          {/* phones: pick a ship right above the board you place it on */}
          <div className="min-[900px]:hidden">{tray}</div>
          <div
            {...boardArea}
            className={cx("max-[480px]:justify-self-center", editing && "mb-placing")}
          >
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
        </div>

        {/* tablets and desktop: the fleet and the actions beside the board */}
        <div className="grid content-start gap-(--space-3) max-[899px]:hidden min-[900px]:pt-[46px]">
          {tray}
          {editing && (
            <div className="mb-row">
              <Button size="sm" icon="shuffle" onClick={onRandomise}>
                Randomise
              </Button>
            </div>
          )}
          {readyButton}
        </div>

        {/* tablets and desktop: under both columns, and never wider than them, so the board stays put */}
        {error && (
          <div className="max-[899px]:hidden min-[900px]:col-span-2 [contain:inline-size]">
            <Banner tone="danger" icon="warning">
              {error}
            </Banner>
          </div>
        )}

        {/* phones: the actions stay in reach at the bottom of the screen */}
        <div className="sticky bottom-0 -mx-(--space-4) flex items-center gap-(--space-2) border-t border-line bg-surface-000 px-(--space-4) pt-(--space-3) pb-[max(var(--space-3),env(safe-area-inset-bottom))] min-[900px]:hidden">
          {editing && (
            <Button icon="shuffle" iconOnly onClick={onRandomise}>
              Randomise
            </Button>
          )}
          <div className="flex-1">{readyButton}</div>
        </div>
      </main>
      {drag && (
        <div
          className="mb-drag-ship"
          aria-hidden
          style={{ left: drag.left, top: drag.top, "--mb-cell": `${drag.cell}px` } as CSSProperties}
        >
          <Ship type={drag.type} orientation={drag.heading} />
        </div>
      )}
    </div>
  );
}
