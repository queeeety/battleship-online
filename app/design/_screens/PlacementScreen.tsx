"use client";

import { useState } from "react";
import { Board, FleetStatus, PlayerChip, SHIPS, type ShipPlacement, type ShipType } from "@/components/game";
import { Banner, Button } from "@/components/ui";
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

  const ships: ShipPlacement[] = showGhost
    ? [...PLACED, { type: selected, ...GHOST_AT, orientation: "horizontal", ghost: "invalid" }]
    : PLACED;

  return (
    <div className={SCREEN}>
      <ScreenBar>
        <PlayerChip name="Teddy" ready />
      </ScreenBar>
      <main className="grid content-start gap-(--space-6) px-(--space-4) pt-(--space-5) pb-(--space-6) min-[900px]:grid-cols-[auto_300px] min-[900px]:px-(--space-6)">
        <div className="grid content-start gap-(--space-4)">
          <h1 className="text-title">Place your fleet</h1>
          <Board variant="own" ships={ships} cellSize="lg" />
          {showGhost && (
            <Banner tone="danger" icon="warning">
              {SHIPS[selected].name} overlaps another ship.
            </Banner>
          )}
        </div>
        <div className="grid content-start gap-(--space-3) min-[900px]:pt-[46px]">
          <FleetStatus mode="placement" selected={selected} onSelect={setSelected} fleet={fleet} />
          <div className="mb-row">
            <Button size="sm" icon="rotate">
              Rotate (R)
            </Button>
            <Button size="sm" icon="shuffle">
              Randomise
            </Button>
          </div>
          <Button variant="primary" block disabled={left > 0}>
            {left > 0 ? `Ready · ${left} ships left` : "Ready"}
          </Button>
        </div>
      </main>
    </div>
  );
}
