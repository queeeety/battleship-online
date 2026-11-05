"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { ActionError } from "@/components/feedback/ActionError";
import { errorText, isToastFailure } from "@/components/feedback/ErrorState";
import { HomeView } from "@/components/screens/HomeView";
import { GameType, JoinError } from "@/lib/enums";
import { LOBBY_CODE_LENGTH } from "@/lib/config";
import { createLobby, joinLobby, type LobbyFailure, type LobbyResult } from "@/lib/server/actions/lobby";
import type { GameTypeName } from "@/components/screens/gameTypes";
import { settle } from "@/utils/settle";

type Action = "create" | "join";

function joinText(error: JoinError): string {
  const { title, detail } = errorText({ kind: "join", error });
  return `${title}. ${detail}`;
}

export function HomeClient({ rejoin }: { rejoin?: ReactNode }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [gameType, setGameType] = useState<GameTypeName>("ORIGINAL");
  const [code, setCode] = useState("");
  const [action, setAction] = useState<Action | null>(null);
  const [failure, setFailure] = useState<{ on: Action; error: LobbyFailure } | null>(null);
  const [codeHint, setCodeHint] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();

  // the transition stays pending through router.push, so the buttons wait until the game page is up
  function run(on: Action, call: () => Promise<LobbyResult>) {
    setAction(on);
    setFailure(null);
    setCodeHint(undefined);
    startTransition(async () => {
      const result = await settle(call);
      if (result.ok) router.push(`/game/${result.code}`);
      else setFailure({ on, error: result.error });
    });
  }

  function create() {
    run("create", () => createLobby(name, GameType[gameType]));
  }

  function join() {
    if (code.length !== LOBBY_CODE_LENGTH) {
      setCodeHint(`Enter the ${LOBBY_CODE_LENGTH}-character code.`);
      return;
    }
    run("join", () => joinLobby(code, name));
  }

  const error = failure?.error;
  const nameError = error === JoinError.INVALID_NAME ? joinText(error) : undefined;
  const codeError =
    failure?.on === "join" && typeof error === "number" && error !== JoinError.INVALID_NAME ? joinText(error) : codeHint;
  const blocking = typeof error === "string" && !isToastFailure(error);

  return (
    <>
      <HomeView
        name={name}
        onNameChange={(n) => {
          setName(n);
          if (error === JoinError.INVALID_NAME) setFailure(null);
        }}
        gameType={gameType}
        onGameTypeChange={setGameType}
        code={code}
        onCodeChange={(c) => {
          setCode(c);
          setCodeHint(undefined);
          // a name error stays until the name changes
          if (failure?.on === "join" && error !== JoinError.INVALID_NAME) setFailure(null);
        }}
        pending={isPending ? action : null}
        nameError={nameError}
        codeError={codeError}
        onCreate={create}
        onJoin={join}
        onPlayAi={() => router.push("/play")}
        // signing in re-renders this page: hide the banner so it never flashes the new lobby
        notice={
          blocking ? (
            <ActionError error={error} onAction={failure?.on === "join" ? join : create} />
          ) : isPending ? null : (
            rejoin
          )
        }
      />
      {typeof error === "string" && isToastFailure(error) && (
        <div className="mb-toast-dock">
          <ActionError error={error} onClose={() => setFailure(null)} />
        </div>
      )}
    </>
  );
}
