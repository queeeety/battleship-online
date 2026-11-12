"use client";

import { useState } from "react";
import { LobbyView } from "@/components/screens/LobbyView";
import { SampleStates, ShowcaseStrip } from "./chrome";

type Stage = "waiting" | "joined";

const CODE = "K7Q2XM";
const LINK = `battleship-online.vercel.app/game/${CODE}`;

export function LobbyScreen() {
  const [stage, setStage] = useState<Stage>("waiting");

  return (
    <>
      <ShowcaseStrip name="Lobby screen">
        <SampleStates
          label="Sample state"
          value={stage}
          onChange={setStage}
          options={[
            { value: "waiting", label: "Waiting" },
            { value: "joined", label: "Opponent joined" },
          ]}
        />
      </ShowcaseStrip>
      <LobbyView
        code={CODE}
        link={LINK}
        href={`https://${LINK}`}
        typeLabel="Original · 15 s turns"
        youName="Tim"
        opponentName={stage === "joined" ? "Teddy" : null}
      />
    </>
  );
}
