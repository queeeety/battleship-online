"use client";

import { useEffect, useState } from "react";
import {
  AbilityCard,
  Board,
  Legend,
  ShotLog,
  TurnIndicator,
  TurnTimer,
  type CellMark,
  type ShipPlacement,
  type ShotLogEntry,
} from "@/components/game";
import { Button, Dialog } from "@/components/ui";
import { TURN_TIME_LIMIT_SECONDS } from "@/lib/config";
import { GameType } from "@/lib/enums";
import { SCREEN, ScreenBar } from "./chrome";

const TURN_SECONDS = TURN_TIME_LIMIT_SECONDS[GameType.ORIGINAL];

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

const TARGET_MARKS: Record<string, CellMark> = {
  B2: "miss", E5: "hit", E6: "hit", D3: "miss", H8: "miss", A1: "sunk", A2: "sunk", J9: "miss", C7: "miss", F9: "miss",
};

const LOG_START: ShotLogEntry[] = [
  { turn: 5, by: "you", coord: "E5", result: "hit" },
  { turn: 5, by: "opponent", coord: "H8", result: "sunk", ship: "submarine" },
  { turn: 6, by: "you", coord: "C7", result: "miss" },
  { turn: 6, by: "opponent", coord: "I4", result: "hit" },
  { turn: 7, by: "you", coord: "E6", result: "hit" },
];

// sample battle: your shots land as misses and the turn stays yours, so the board can be tried out
export function BattleScreen() {
  const [shots, setShots] = useState<string[]>([]);
  const [log, setLog] = useState(LOG_START);
  const [turn, setTurn] = useState(7);
  const [seconds, setSeconds] = useState(9);
  const [armed, setArmed] = useState(false);
  const [forfeitOpen, setForfeitOpen] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setSeconds((s) => (s <= 0 ? TURN_SECONDS : s - 1)), 1000);
    return () => clearInterval(id);
  }, []);

  const marks = { ...TARGET_MARKS, ...Object.fromEntries(shots.map((key) => [key, "miss" as const])) };

  function fire(key: string) {
    setShots((s) => [...s, key]);
    setLog((l) => [...l, { turn: turn + 1, by: "you", coord: key, result: "miss" }]);
    setTurn((t) => t + 1);
    setSeconds(TURN_SECONDS);
  }

  return (
    <div className={SCREEN}>
      <ScreenBar>
        <span className="mb-label hidden min-[600px]:inline">Original · Lobby K7Q2XM</span>
        <Button size="sm" variant="danger" icon="flag" onClick={() => setForfeitOpen(true)}>
          Forfeit
        </Button>
      </ScreenBar>

      {/* below 1200px: target board, then the HUD, then your own board; below 900px the HUD is one strip */}
      <main className="flex flex-col gap-(--space-5) px-(--space-4) pt-(--space-4) pb-(--space-6) min-[900px]:gap-(--space-6) min-[900px]:pt-(--space-5) min-[1200px]:grid min-[1200px]:grid-cols-[auto_auto_var(--hud-width)] min-[1200px]:items-start min-[1200px]:px-(--space-6)">
        <div className="order-1 max-[480px]:self-center min-[1200px]:order-none">
          <Board
            variant="target"
            title="Enemy waters"
            meta="4 of 5 afloat"
            marks={marks}
            ships={[{ type: "destroyer", x: 0, y: 0, orientation: "vertical", status: "sunk" }]}
            active
            sweeping
            lastShot={shots.at(-1)}
            cellSize="lg"
            onCellClick={(cell) => fire(cell.key)}
          />
        </div>
        <div className="order-3 grid content-start gap-(--space-3) max-[480px]:justify-items-center min-[1200px]:order-none">
          <Board variant="own" title="Your waters" meta="4 of 5 afloat" marks={OWN_MARKS} ships={OWN_SHIPS} cellSize="sm" />
          <div className="max-[899px]:hidden">
            <Legend />
          </div>
        </div>

        {/* phones: everything needed on your turn in one strip, right under the board you fire at */}
        <section className="mb-strip order-2 min-[900px]:hidden" aria-label="Your turn">
          <div className="flex items-center gap-(--space-3)">
            <TurnIndicator turn="you" />
            <div className="min-w-0 flex-1">
              <TurnTimer seconds={seconds} total={TURN_SECONDS} size="sm" />
            </div>
          </div>
          <AbilityCard
            ability="line-scan"
            state={armed ? "armed" : "ready"}
            onUse={() => setArmed(true)}
            onCancel={() => setArmed(false)}
            compact
          />
          <ShotLog opponentLabel="Teddy" entries={log.slice(-1)} />
        </section>

        {/* tablets and desktop: the full HUD column */}
        <div className="order-2 grid content-start gap-(--space-3) max-[899px]:hidden min-[900px]:max-[1199px]:grid-cols-2 min-[1200px]:order-none">
          <TurnIndicator turn="you" turnNumber={turn} />
          <TurnTimer seconds={seconds} total={TURN_SECONDS} />
          <AbilityCard
            ability="line-scan"
            state={armed ? "armed" : "ready"}
            onUse={() => setArmed(true)}
            onCancel={() => setArmed(false)}
          />
          <ShotLog opponentLabel="Teddy" maxHeight={120} entries={log} />
        </div>

        {/* phones: the full log and the key to the marks, folded away under your board */}
        <details className="order-4 min-[900px]:hidden">
          <summary className="mb-label cursor-pointer py-(--space-2)">Shot log and key</summary>
          <div className="grid gap-(--space-3) pt-(--space-2)">
            <ShotLog opponentLabel="Teddy" maxHeight={160} entries={log} />
            <Legend />
          </div>
        </details>
      </main>

      <Dialog
        open={forfeitOpen}
        title="Forfeit this game?"
        onClose={() => setForfeitOpen(false)}
        actions={
          <>
            <Button onClick={() => setForfeitOpen(false)}>Keep playing</Button>
            <Button variant="danger" icon="flag" onClick={() => setForfeitOpen(false)}>
              Forfeit
            </Button>
          </>
        }
      >
        <p>Teddy wins and the result is recorded. You can still ask for a rematch.</p>
      </Dialog>
    </div>
  );
}
