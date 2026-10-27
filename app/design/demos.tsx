"use client";

import { useState } from "react";
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
