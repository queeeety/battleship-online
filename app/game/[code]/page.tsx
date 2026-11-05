import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { StatusView } from "@/components/screens/StatusView";
import { LOBBY_CODE_CHARS, LOBBY_CODE_LENGTH } from "@/lib/config";
import { GameClient } from "./GameClient";

export const metadata: Metadata = {
  title: "Game",
};

function isLobbyCode(code: string): boolean {
  return code.length === LOBBY_CODE_LENGTH && [...code].every((c) => LOBBY_CODE_CHARS.includes(c));
}

// params are request data, so the page waits for them inside Suspense
async function Game({ params }: { params: PageProps<"/game/[code]">["params"] }) {
  const code = (await params).code.toUpperCase();
  if (!isLobbyCode(code)) notFound();
  return <GameClient code={code} />;
}

export default function GamePage({ params }: PageProps<"/game/[code]">) {
  return (
    <Suspense fallback={<StatusView title="Connecting…" />}>
      <Game params={params} />
    </Suspense>
  );
}
