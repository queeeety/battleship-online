"use client";

import { useState } from "react";
import { Board, FleetStatus, PlayerChip, SHIPS, type ShipPlacement, type ShipType } from "@/components/game";
import { Banner, Button, Icon } from "@/components/ui";
import { SCREEN, ScreenBar } from "./chrome";

const PLACED: ShipPlacement[] = [
  { type: "carrier", x: 1, y: 1, orientation: "horizontal" },
  { type: "battleship", x: 8, y: 2, orientation: "vertical" },
  { type: "destroyer", x: 4, y: 4, orientation: "horizontal" },
];

const FLEET_ORDER: ShipType[] = ["carrier", "battleship", "cruiser", "submarine", "destroyer"];

// a fixed sample: the selected ship hangs over the destroyer, so it shows as an invalid ghost
const GHOST_AT = { x: 3, y: 4 };

export function PlacementScreen() {
  const [selected, setSelected] = useState<ShipType>("cruiser");
  const placedTypes = new Set(PLACED.map((s) => s.type));
  const fleet = FLEET_ORDER.map((type) => ({ type, placed: placedTypes.has(type) }));
  const left = fleet.filter((f) => !f.placed).length;
  const showGhost = !placedTypes.has(selected);
  const error = showGhost ? `${SHIPS[selected].name} overlaps another ship.` : null;

  const ships: ShipPlacement[] = showGhost
    ? [...PLACED, { type: selected, ...GHOST_AT, orientation: "horizontal", ghost: "invalid" }]
    : PLACED;

  const tray = <FleetStatus mode="placement" selected={selected} onSelect={setSelected} fleet={fleet} />;
  const ready = (
    <Button variant="primary" block disabled={left > 0}>
      {left > 0 ? `Ready · ${left} ships left` : "Ready"}
    </Button>
  );

  return (
    <div className={SCREEN}>
      <ScreenBar>
        <span className="mb-label min-[600px]:hidden">Teddy · Ready</span>
        <div className="max-[599px]:hidden">
          <PlayerChip name="Teddy" ready />
        </div>
      </ScreenBar>
      <main className="grid content-start gap-(--space-6) px-(--space-4) pt-(--space-4) min-[900px]:grid-cols-[auto_300px] min-[900px]:px-(--space-6) min-[900px]:pt-(--space-5) min-[900px]:pb-(--space-6)">
        <div className="grid content-start gap-(--space-4)">
          <h1 className="text-title">Place your fleet</h1>
          {/* phones: pick a ship right above the board you place it on */}
          <div className="min-[900px]:hidden">{tray}</div>
          <div className="max-[480px]:justify-self-center">
            <Board variant="own" ships={ships} cellSize="lg" />
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
          <div className="mb-row">
            <Button size="sm" icon="rotate">
              Rotate (R)
            </Button>
            <Button size="sm" icon="shuffle">
              Randomise
            </Button>
          </div>
          {ready}
        </div>

        {/* phones: the actions stay in reach at the bottom of the screen */}
        <div className="sticky bottom-0 -mx-(--space-4) flex items-center gap-(--space-2) border-t border-line bg-surface-000 px-(--space-4) pt-(--space-3) pb-[max(var(--space-3),env(safe-area-inset-bottom))] min-[900px]:hidden">
          <Button icon="rotate" iconOnly>
            Rotate
          </Button>
          <Button icon="shuffle" iconOnly>
            Randomise
          </Button>
          <div className="flex-1">{ready}</div>
        </div>
      </main>
    </div>
  );
}
