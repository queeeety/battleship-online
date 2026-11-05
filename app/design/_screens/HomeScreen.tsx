"use client";

import { useState } from "react";
import { HomeView } from "@/components/screens/HomeView";
import type { GameTypeName } from "@/components/screens/gameTypes";

// sample home: the fields work, the buttons go nowhere
export function HomeScreen() {
  const [name, setName] = useState("");
  const [gameType, setGameType] = useState<GameTypeName>("ORIGINAL");
  const [code, setCode] = useState("");

  return (
    <HomeView
      name={name}
      onNameChange={setName}
      gameType={gameType}
      onGameTypeChange={setGameType}
      code={code}
      onCodeChange={setCode}
      onCreate={() => {}}
      onJoin={() => {}}
      onPlayAi={() => {}}
    />
  );
}
