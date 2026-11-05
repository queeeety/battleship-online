"use client";

import { useState } from "react";
import type { ShipPlacement } from "@/components/game";
import { PlacementView } from "@/components/screens/PlacementView";
import {
  FLEET_ORDER,
  isPlaced,
  placementError,
  placementErrorText,
  readyLabel,
  squareKeys,
  toShipPlacements,
  type Layout,
} from "@/components/screens/placement";
import { usePlacement } from "@/hooks/usePlacement";
import { SampleStates, ShowcaseStrip } from "./chrome";

type Stage = "editing" | "error" | "locked";

// three ships already down, so the sample opens part-way through
const PLACED: Layout = [
  { name: "Carrier", row: 1, col: 1, orientation: "horizontal" },
  { name: "Battleship", row: 2, col: 8, orientation: "vertical" },
  { name: "Destroyer", row: 4, col: 4, orientation: "horizontal" },
];

// the whole fleet, for the locked sample
const FULL: Layout = [
  ...PLACED,
  { name: "Cruiser", row: 7, col: 1, orientation: "horizontal" },
  { name: "Submarine", row: 9, col: 5, orientation: "horizontal" },
];

// the error sample: the cruiser hangs over the destroyer, so it shows as an invalid ghost
const GHOST = { type: "cruiser", x: 3, y: 4, orientation: "horizontal" } as const;
const GHOST_ERROR = placementError(PLACED, GHOST.type, GHOST.x, GHOST.y, GHOST.orientation);

const OPPONENT = { name: "Teddy", ready: true };

// the real editor, with Ready locking the fleet here instead of sending it
function Editor({ onReady }: { onReady: (layout: Layout) => void }) {
  const placement = usePlacement(PLACED);
  return (
    <PlacementView
      {...placement.editor}
      ready={{
        label: readyLabel(placement.left),
        disabled: !placement.complete,
        onClick: () => onReady(placement.layout),
      }}
      opponent={OPPONENT}
    />
  );
}

export function PlacementScreen() {
  const [stage, setStage] = useState<Stage>("editing");
  const [locked, setLocked] = useState<Layout>(FULL);

  let screen;
  if (stage === "locked") {
    screen = (
      <PlacementView
        title="Fleet ready"
        board={{ ships: toShipPlacements(locked) }}
        fleet={FLEET_ORDER.map((type) => ({ type, placed: true }))}
        ready={{ label: "Waiting for Teddy…", disabled: true }}
        opponent={{ ...OPPONENT, ready: false }}
      />
    );
  } else if (stage === "error") {
    const ghost: ShipPlacement = { ...GHOST, ghost: "invalid" };
    screen = (
      <PlacementView
        board={{
          ships: [...toShipPlacements(PLACED), ghost],
          highlight: { keys: squareKeys(GHOST.type, GHOST.x, GHOST.y, GHOST.orientation), valid: false },
        }}
        fleet={FLEET_ORDER.map((type) => ({ type, placed: isPlaced(PLACED, type) }))}
        selected={GHOST.type}
        error={GHOST_ERROR === null ? null : placementErrorText(GHOST_ERROR, GHOST.type)}
        ready={{ label: readyLabel(2), disabled: true }}
        opponent={OPPONENT}
      />
    );
  } else {
    screen = (
      <Editor
        onReady={(layout) => {
          setLocked(layout);
          setStage("locked");
        }}
      />
    );
  }

  return (
    <>
      <ShowcaseStrip name="Placement screen">
        <SampleStates
          label="Sample state"
          value={stage}
          onChange={setStage}
          options={[
            { value: "editing", label: "Editing" },
            { value: "error", label: "Overlap error" },
            { value: "locked", label: "Fleet ready" },
          ]}
        />
      </ShowcaseStrip>
      {screen}
    </>
  );
}
