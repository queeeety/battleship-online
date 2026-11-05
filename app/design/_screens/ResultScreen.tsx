"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  coordKey,
  SHIPS,
  type CellMark,
  type RematchState,
  type ShipPlacement,
  type ShipType,
} from "@/components/game";
import { Button } from "@/components/ui";
import { ResultView } from "@/components/screens/ResultView";
import { SampleStates, ShowcaseStrip } from "./chrome";

type Outcome = "victory" | "defeat";

const ENEMY_SHIPS: ShipPlacement[] = [
  { type: "carrier", x: 1, y: 8, orientation: "horizontal" },
  { type: "battleship", x: 7, y: 1, orientation: "vertical" },
  { type: "cruiser", x: 2, y: 2, orientation: "horizontal" },
  { type: "submarine", x: 5, y: 4, orientation: "vertical" },
  { type: "destroyer", x: 0, y: 0, orientation: "vertical" },
];

// your shots that missed, in the order fired
const MISSES = [
  "B2", "D1", "F2", "J1", "G4", "I6", "B5", "D6", "J4", "A7", "C7", "H7",
  "J8", "E5", "G9", "I10", "B10", "D8", "H9", "J6", "A4", "E1", "G1", "C5",
];

const OWN_SHIPS: ShipPlacement[] = [
  { type: "carrier", x: 1, y: 1, orientation: "horizontal" },
  { type: "battleship", x: 8, y: 2, orientation: "vertical", status: "damaged" },
  { type: "cruiser", x: 2, y: 5, orientation: "vertical" },
  { type: "submarine", x: 5, y: 7, orientation: "horizontal", status: "sunk" },
  { type: "destroyer", x: 4, y: 4, orientation: "horizontal" },
];

const OWN_MARKS: Record<string, CellMark> = {
  I4: "hit", C3: "miss", G3: "miss", A9: "miss", F8: "sunk", G8: "sunk", H8: "sunk", J10: "miss", E6: "miss",
};

function cellsOf(ship: ShipPlacement): string[] {
  return Array.from({ length: SHIPS[ship.type].length }, (_, i) =>
    ship.orientation === "horizontal" ? coordKey(ship.x + i, ship.y) : coordKey(ship.x, ship.y + i),
  );
}

// the final enemy board: sunk ships drawn, hit cells on the rest, and the misses
function enemyBoard(sunk: ShipType[], hits: string[], misses: string[]) {
  const ships = ENEMY_SHIPS.filter((s) => sunk.includes(s.type)).map((s) => ({ ...s, status: "sunk" as const }));
  const marks: Record<string, CellMark> = {};
  for (const key of misses) marks[key] = "miss";
  for (const key of hits) marks[key] = "hit";
  for (const ship of ships) for (const key of cellsOf(ship)) marks[key] = "sunk";
  return { ships, marks, shots: misses.length + hits.length + ships.reduce((n, s) => n + SHIPS[s.type].length, 0) };
}

// victory: the whole enemy fleet sunk. defeat: you forfeited with two ships sunk and the battleship hit twice
const SAMPLES = {
  victory: { reason: "FLEET_DESTROYED" as const, ...enemyBoard(ENEMY_SHIPS.map((s) => s.type), [], MISSES) },
  defeat: { reason: "OPPONENT_FORFEIT" as const, ...enemyBoard(["destroyer", "cruiser"], ["H2", "H3"], MISSES.slice(0, 16)) },
};

export function ResultScreen() {
  const router = useRouter();
  const [outcome, setOutcome] = useState<Outcome>("victory");
  const [rematch, setRematch] = useState<RematchState>("none");
  const sample = SAMPLES[outcome];
  const hits = Object.values(sample.marks).filter((m) => m === "hit" || m === "sunk").length;
  const afloat = ENEMY_SHIPS.length - sample.ships.length;

  return (
    <>
      <ShowcaseStrip name="Result screen">
        <SampleStates
          label="Sample outcome"
          value={outcome}
          onChange={(o) => {
            setOutcome(o);
            setRematch("none");
          }}
          options={[
            { value: "victory", label: "Victory" },
            { value: "defeat", label: "Defeat" },
          ]}
        />
        <Button
          size="sm"
          variant="ghost"
          disabled={rematch !== "none" && rematch !== "requested-by-you"}
          onClick={() => setRematch("requested-by-opponent")}
        >
          {/* the full label doesn't fit the strip on phones */}
          <span className="max-[599px]:sr-only">Teddy asks for a rematch</span>
          <span className="min-[600px]:hidden" aria-hidden="true">
            Rematch?
          </span>
        </Button>
      </ShowcaseStrip>
      <ResultView
        barLabel="Original · Lobby K7Q2XM"
        summary={{
          didWin: outcome === "victory",
          reason: sample.reason,
          shotsFired: sample.shots,
          accuracy: hits / sample.shots,
          shipsSunk: sample.ships.length,
        }}
        rematch={{
          status: rematch,
          opponentName: "Teddy",
          onRequest: () => setRematch("requested-by-you"),
          onAccept: () => setRematch("accepted"),
          onDecline: () => setRematch("declined"),
          onHome: () => router.push("/design/home"),
        }}
        enemy={{ meta: `${afloat} of 5 afloat`, marks: sample.marks, ships: sample.ships }}
        own={{ meta: "4 of 5 afloat", marks: OWN_MARKS, ships: OWN_SHIPS }}
      />
    </>
  );
}
