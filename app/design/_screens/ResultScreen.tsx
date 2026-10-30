"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Board,
  coordKey,
  RematchPanel,
  ResultSummary,
  SHIPS,
  type CellMark,
  type RematchState,
  type ShipPlacement,
  type ShipType,
} from "@/components/game";
import { Button, SegmentedControl } from "@/components/ui";
import { SampleStates, SCREEN, ScreenBar, ShowcaseStrip } from "./chrome";

type Outcome = "victory" | "defeat";
type BoardView = "enemy" | "own";

const ENEMY_SHIPS: ShipPlacement[] = [
  { type: "carrier", x: 1, y: 8, orientation: "horizontal" },
  { type: "battleship", x: 7, y: 1, orientation: "vertical" },
  { type: "cruiser", x: 2, y: 2, orientation: "horizontal" },
  { type: "submarine", x: 5, y: 5, orientation: "vertical" },
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
  const [boardView, setBoardView] = useState<BoardView>("enemy");
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
      <div className={SCREEN}>
        <ScreenBar>
          <span className="mb-label hidden min-[600px]:inline">Original · Lobby K7Q2XM</span>
        </ScreenBar>
        {/* everything centred: the summary on top, the two final boards under it */}
        <main className="grid content-start justify-items-center gap-(--space-6) px-(--space-4) pt-(--space-5) pb-(--space-6) min-[900px]:px-(--space-6)">
          <div className="grid w-full max-w-[460px] gap-(--space-4)">
            <ResultSummary
              didWin={outcome === "victory"}
              reason={sample.reason}
              shotsFired={sample.shots}
              accuracy={hits / sample.shots}
              shipsSunk={sample.ships.length}
            />
            <RematchPanel
              status={rematch}
              opponentName="Teddy"
              onRequest={() => setRematch("requested-by-you")}
              onAccept={() => setRematch("accepted")}
              onDecline={() => setRematch("declined")}
              onHome={() => router.push("/design/home")}
            />
          </div>
          <section className="grid w-fit max-w-full gap-(--space-3)" aria-label="Final boards">
            <span className="mb-label max-[899px]:hidden">Final boards</span>
            {/* phones: one board at a time */}
            <div className="min-[900px]:hidden">
              <SegmentedControl
                label="Final boards"
                value={boardView}
                onChange={(v) => setBoardView(v as BoardView)}
                options={[
                  { value: "enemy", label: "Enemy waters" },
                  { value: "own", label: "Your waters" },
                ]}
              />
            </div>
            <div className="flex flex-wrap items-start justify-center gap-(--space-6)">
              <div className={boardView === "enemy" ? undefined : "max-[899px]:hidden"}>
                <Board
                  variant="target"
                  title="Enemy waters"
                  meta={`${afloat} of 5 afloat`}
                  marks={sample.marks}
                  ships={sample.ships}
                />
              </div>
              <div className={boardView === "own" ? undefined : "max-[899px]:hidden"}>
                <Board variant="own" title="Your waters" meta="4 of 5 afloat" marks={OWN_MARKS} ships={OWN_SHIPS} />
              </div>
            </div>
          </section>
        </main>
      </div>
    </>
  );
}
