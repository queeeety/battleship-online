"use client";

import { useEffect, useState } from "react";
import {
  AbilityCard,
  AbilityDraw,
  ABILITIES,
  Board,
  coordKey,
  FleetStatus,
  LobbyCode,
  ShotLog,
  TurnTimer,
  type AbilityId,
  type CellMark,
  type ShipType,
  type ShotLogEntry,
} from "@/components/game";
import { Button, Dialog, SegmentedControl, TextField, Toast } from "@/components/ui";

export function GameSetupDemo() {
  const [gameType, setGameType] = useState("ORIGINAL");
  const [difficulty, setDifficulty] = useState("NORMAL");

  return (
    <div className="grid max-w-[440px] gap-(--space-4)">
      <SegmentedControl
        label="Game type"
        value={gameType}
        onChange={setGameType}
        options={[
          { value: "BEGINNER", label: "Beginner", meta: "30 s turns" },
          { value: "ORIGINAL", label: "Original", meta: "15 s turns" },
          { value: "QUICK_FIRE", label: "Quick Fire", meta: "5 s turns" },
        ]}
      />
      <SegmentedControl
        label="AI difficulty"
        value={difficulty}
        onChange={setDifficulty}
        options={[
          { value: "EASY", label: "Easy" },
          { value: "NORMAL", label: "Normal" },
        ]}
      />
    </div>
  );
}

export function JoinCodeDemo() {
  const [code, setCode] = useState("");
  const error = code.length === 6 && code !== "K7Q2XM" ? "No lobby with that code." : undefined;

  return (
    <TextField
      label="Lobby code"
      code
      maxLength={6}
      placeholder="K7Q2XM"
      value={code}
      onChange={setCode}
      error={error}
      hint="Try K7Q2XM, or any other six letters."
    />
  );
}

export function ToastDemo() {
  const [shown, setShown] = useState(true);

  return (
    <div className="grid justify-items-start gap-(--space-2)">
      <Toast tone="hit" icon="target">
        Hit on E6.
      </Toast>
      {shown ? (
        <Toast tone="sonar" icon="radar-sweep" onClose={() => setShown(false)}>
          Radar Sweep: 1 contact.
        </Toast>
      ) : (
        <Button size="sm" variant="ghost" onClick={() => setShown(true)}>
          Show the dismissed toast
        </Button>
      )}
      <Toast icon="copy">Lobby code copied.</Toast>
    </div>
  );
}

export function ForfeitDialogDemo() {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <>
      <Button variant="danger" icon="flag" onClick={() => setOpen(true)}>
        Forfeit
      </Button>
      <Dialog
        open={open}
        title="Forfeit this game?"
        onClose={close}
        actions={
          <>
            <Button onClick={close}>Keep playing</Button>
            <Button variant="danger" icon="flag" onClick={close}>
              Forfeit
            </Button>
          </>
        }
      >
        <p>Teddy wins and the result is recorded. You can still ask for a rematch.</p>
      </Dialog>
    </>
  );
}

const TARGET_MARKS: Record<string, CellMark> = {
  B2: "miss", E5: "hit", E6: "hit", D3: "miss", H8: "miss", J9: "miss", A1: "sunk", A2: "sunk",
  G2: "contact", F2: "clear", H2: "clear", F3: "clear", G3: "clear", H3: "clear", F4: "clear", G4: "clear", H4: "clear",
};

export function TargetBoardDemo() {
  const [shots, setShots] = useState<string[]>([]);
  const marks = { ...TARGET_MARKS, ...Object.fromEntries(shots.map((key) => [key, "miss" as const])) };

  return (
    <Board
      variant="target"
      title="Enemy waters"
      meta="4 of 5 afloat"
      marks={marks}
      ships={[{ type: "destroyer", x: 0, y: 0, orientation: "vertical", status: "sunk" }]}
      active
      sweeping
      scanArea={{ x: 5, y: 1, w: 3, h: 3 }}
      lastShot={shots.at(-1) ?? "E6"}
      onCellClick={(cell) => setShots((s) => [...s, cell.key])}
    />
  );
}

export function FleetPlacementDemo() {
  const [selected, setSelected] = useState<ShipType>("cruiser");

  return (
    <FleetStatus
      mode="placement"
      selected={selected}
      onSelect={setSelected}
      fleet={[
        { type: "carrier", placed: true },
        { type: "battleship", placed: true },
        { type: "cruiser" },
        { type: "submarine" },
        { type: "destroyer", placed: true },
      ]}
    />
  );
}

export function TurnTimerDemo() {
  const [seconds, setSeconds] = useState(15);

  useEffect(() => {
    const id = setInterval(() => setSeconds((s) => (s <= 0 ? 15 : s - 1)), 1000);
    return () => clearInterval(id);
  }, []);

  return <TurnTimer seconds={seconds} total={15} />;
}

export function AbilityCardDemo() {
  const [armed, setArmed] = useState(false);

  return (
    <AbilityCard
      ability="radar-sweep"
      state={armed ? "armed" : "ready"}
      onUse={() => setArmed(true)}
      onCancel={() => setArmed(false)}
    />
  );
}

export function AbilityDrawDemo() {
  const [open, setOpen] = useState(false);
  const [held, setHeld] = useState<AbilityId>("reroute");
  const drawn: AbilityId = held === "reroute" ? "radar-sweep" : "reroute";

  return (
    <div className="mb-row">
      <Button onClick={() => setOpen(true)}>Draw an ability</Button>
      <span className="text-small text-ink-muted">Holding {ABILITIES[held].name}</span>
      <Dialog open={open} title="You drew an ability" onClose={() => setOpen(false)}>
        <AbilityDraw
          current={held}
          drawn={drawn}
          onKeep={() => setOpen(false)}
          onReplace={() => {
            setHeld(drawn);
            setOpen(false);
          }}
        />
      </Dialog>
    </div>
  );
}

const LOG_START: ShotLogEntry[] = [
  { turn: 4, by: "you", coord: "B2", result: "miss" },
  { turn: 4, by: "opponent", coord: "I3", result: "hit" },
  { turn: 5, by: "you", coord: "E5", result: "hit" },
  { turn: 5, by: "opponent", coord: "H8", result: "sunk", ship: "submarine" },
  { turn: 6, by: "you", ability: "radar-sweep", coord: "F2", note: "1 contact" },
  { turn: 6, by: "opponent", coord: "C3", result: "miss" },
  { turn: 7, by: "you", coord: "E6", result: "hit" },
];

// you fire first each turn, then the opponent on the same turn number
function nextShot(entries: ShotLogEntry[]): ShotLogEntry {
  const last = entries[entries.length - 1];
  const by = last.by === "you" ? "opponent" : "you";
  const n = entries.length;
  return {
    turn: by === "you" ? last.turn + 1 : last.turn,
    by,
    coord: coordKey(n % 10, (n * 3) % 10),
    result: n % 3 === 0 ? "hit" : "miss",
  };
}

export function ShotLogDemo() {
  const [entries, setEntries] = useState(LOG_START);

  return (
    <div className="grid w-[340px] max-w-full gap-(--space-2)">
      <ShotLog opponentLabel="Teddy" maxHeight={150} entries={entries} />
      <div>
        <Button size="sm" onClick={() => setEntries((e) => [...e, nextShot(e)])}>
          Add a shot
        </Button>
      </div>
    </div>
  );
}

export function LobbyCodeDemo() {
  const [toast, setToast] = useState<string | null>(null);

  // toasts go away on their own after about 3 seconds
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(id);
  }, [toast]);

  async function copy(text: string, done: string) {
    try {
      await navigator.clipboard.writeText(text);
      setToast(done);
    } catch {
      setToast("Couldn't copy. Select the code and copy it by hand.");
    }
  }

  return (
    <div className="grid max-w-[420px] justify-items-start gap-(--space-3)">
      <LobbyCode
        code="K7Q2XM"
        link="mybattleship.app/j/K7Q2XM"
        onCopyCode={() => copy("K7Q2XM", "Lobby code copied.")}
        onCopyLink={() => copy("https://mybattleship.app/j/K7Q2XM", "Link copied.")}
      />
      {toast && (
        <Toast icon="copy" onClose={() => setToast(null)}>
          {toast}
        </Toast>
      )}
    </div>
  );
}
