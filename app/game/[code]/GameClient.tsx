"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { ActionError } from "@/components/feedback/ActionError";
import { ErrorState, errorText, isToastFailure, type ActionFailure } from "@/components/feedback/ErrorState";
import { ErrorToast } from "@/components/feedback/ErrorToast";
import { gameTypeLabel, gameTypeName } from "@/components/screens/gameTypes";
import { JoinView } from "@/components/screens/JoinView";
import { LobbyView } from "@/components/screens/LobbyView";
import { ScreenFade } from "@/components/screens/chrome";
import { screenFor } from "@/components/screens/screenFor";
import { StatusView } from "@/components/screens/StatusView";
import { Button } from "@/components/ui";
import { useGameConnection } from "@/hooks/useGameConnection";
import { settle } from "@/utils/settle";
import type { PlayerView } from "@/lib/controllers/Server";
import { JoinError } from "@/lib/enums";
import { getMyState, type BattleFailure, type BattleResult } from "@/lib/server/actions/battle";
import { joinLobby, type LobbyFailure } from "@/lib/server/actions/lobby";
import type { WirePrivatePayload } from "@/lib/boundary/NetworkHandler";
import { useGameSounds } from "@/hooks/useGameSounds";
import { useEndHold } from "@/hooks/useEndHold";
import { useScreenFocus } from "@/hooks/useScreenFocus";
import { BattleStage } from "@/components/screens/BattleStage";
import { PlacementStage } from "./PlacementStage";
import { ResultStage } from "./ResultStage";
import { serverActions } from "./serverActions";

// the page's address never changes while it's open
const noSubscribe = () => () => {};

// a seated player suddenly told they have no seat asks once more after this
const RECHECK_MS = 1500;
const FAILURE_MS = 6000;

function failureText(error: ActionFailure): string {
  const { title, detail } = errorText(typeof error === "number" ? { kind: "join", error } : { kind: "server", error });
  return `${title}. ${detail}`;
}

/** One game, start to finish: the join form if we have no seat, then realtime updates. */
export function GameClient({ code }: { code: string }) {
  const [view, setView] = useState<PlayerView | null>(null);
  const [notSeated, setNotSeated] = useState(false);
  const [wasSeated, setWasSeated] = useState(false);
  // numbered, so the same error twice still restarts its toast
  const [failed, setFailed] = useState<{ error: BattleFailure; id: number } | null>(null);
  const failure = failed?.error ?? null;
  const fail = useCallback((error: BattleFailure) => setFailed((f) => ({ error, id: (f?.id ?? 0) + 1 })), []);
  const [attempt, setAttempt] = useState(0);
  const origin = useSyncExternalStore(noSubscribe, () => window.location.origin, () => "");

  // read inside apply, which the connection holds on to between renders
  const seated = useRef(false);
  const rechecking = useRef(false);

  const show = useCallback((next: PlayerView) => {
    // only the first view clears a failure: a later broadcast doesn't mean the action went through
    if (!seated.current) setFailed(null);
    seated.current = true;
    setView(next);
    setNotSeated(false);
    setWasSeated(true);
  }, []);

  const apply = useCallback(
    (result: BattleResult<PlayerView>) => {
      if (result.ok) {
        show(result.data);
      } else if (result.error === "NOT_SEATED" && seated.current && !rechecking.current) {
        // may be a session hiccup, and giving up hands the opponent the win, so ask once more
        rechecking.current = true;
        setTimeout(() => {
          void settle(() => getMyState(code)).then((again) => {
            rechecking.current = false;
            if (again.ok) show(again.data);
            else if (again.error === "NOT_SEATED") setNotSeated(true);
            else fail(again.error);
          });
        }, RECHECK_MS);
      } else if (result.error === "NOT_SEATED") {
        if (!rechecking.current) setNotSeated(true);
      } else {
        fail(result.error);
      }
    },
    [code, show, fail],
  );

  // the realtime channels only admit seated players, so look first and connect after
  useEffect(() => {
    let live = true;
    void settle(() => getMyState(code)).then((result) => {
      if (live) apply(result);
    });
    return () => {
      live = false;
    };
  }, [code, attempt, apply]);

  // a fresh object per message, so two identical ones both register
  const [lastPrivate, setLastPrivate] = useState<{ payload: WirePrivatePayload } | null>(null);
  // null until the first presence sync
  const [othersOnline, setOthersOnline] = useState<number | null>(null);

  const { refresh } = useGameConnection(code, {
    enabled: wasSeated && !notSeated,
    name: view?.you.name ?? null,
    onState: (next) => apply({ ok: true, data: next }),
    onError: (error) => apply({ ok: false, error: error as BattleFailure }),
    onPrivate: (payload) => setLastPrivate({ payload }),
    onPresence: (others) => setOthersOnline(others.length),
  });

  // here rather than in the battle, so the shot that ends the game still makes its sound
  useGameSounds(view);
  const actions = useMemo(() => serverActions(code), [code]);

  const [joinName, setJoinName] = useState("");
  const [joinError, setJoinError] = useState<LobbyFailure | null>(null);
  const [joining, startJoin] = useTransition();

  function join() {
    setJoinError(null);
    setFailed(null);
    startJoin(async () => {
      const result = await settle(() => joinLobby(code, joinName));
      if (!result.ok) {
        setJoinError(result.error);
        return;
      }
      apply(await settle(() => getMyState(code)));
    });
  }

  function retry() {
    setFailed(null);
    setNotSeated(false);
    // from scratch, so the old game doesn't come back on screen meanwhile
    setView(null);
    seated.current = false;
    setAttempt((n) => n + 1);
  }

  useEffect(() => {
    if (!failed) return;
    const id = setTimeout(() => setFailed(null), FAILURE_MS);
    return () => clearTimeout(id);
  }, [failed]);

  const screen = useEndHold(screenFor({ view, notSeated, wasSeated }), view?.endReason ?? null);
  useScreenFocus(screen);
  // with a view on screen a failure is a toast; without one it takes the screen or the join form
  const toast =
    failed !== null && view !== null ? (
      isToastFailure(failed.error) ? (
        <ActionError key={failed.id} error={failed.error} onClose={() => setFailed(null)} onStale={refresh} />
      ) : (
        <ErrorToast key={failed.id} error={failed.error} onClose={() => setFailed(null)} />
      )
    ) : null;
  const joinFailure = joinError ?? (screen === "join" ? failure : null);

  let body;
  if (screen === "loading" && failure !== null) {
    body = (
      <StatusView title="Couldn't load the game" home>
        <ErrorState kind="server" error={failure} actionLabel="Try again" onAction={retry} />
      </StatusView>
    );
  } else if (screen === "loading") {
    body = <StatusView title="Connecting…" detail={`Game ${code}`} />;
  } else if (screen === "join") {
    body = (
      <JoinView
        code={code}
        name={joinName}
        onNameChange={(name) => {
          setJoinName(name);
          if (joinError === JoinError.INVALID_NAME) setJoinError(null);
        }}
        onJoin={join}
        pending={joining}
        nameError={joinFailure === JoinError.INVALID_NAME ? failureText(joinFailure) : undefined}
        error={joinFailure !== null && joinFailure !== JoinError.INVALID_NAME ? failureText(joinFailure) : undefined}
      />
    );
  } else if (screen === "gone") {
    body = (
      <StatusView title="This game is gone" detail="It was closed, or cleared away after it ended." home>
        <div>
          <Button onClick={retry}>Try again</Button>
        </div>
      </StatusView>
    );
  } else if (screen === "closed") {
    body = <StatusView title="This lobby closed" detail="Nobody joined in time, so the lobby closed." home />;
  } else if (screen === "lobby" && view) {
    const link = origin ? `${origin}/game/${code}` : `/game/${code}`;
    body = (
      <LobbyView
        code={code}
        link={link.replace(/^https?:\/\//, "")}
        href={link}
        typeLabel={gameTypeLabel(view.gameType)}
        youName={view.you.name}
        opponentName={view.opponent?.name ?? null}
        leaveHref="/"
      />
    );
  } else if (screen === "placement" && view) {
    body = <PlacementStage code={code} view={view} refresh={refresh} onFailure={fail} />;
  } else if (screen === "battle" && view) {
    body = (
      <BattleStage
        view={view}
        actions={actions}
        barLabel={`${gameTypeName(view.gameType)} · Lobby ${code}`}
        lastPrivate={lastPrivate}
        refresh={refresh}
        onFailure={fail}
        failure={toast}
      />
    );
  } else if (screen === "result" && view) {
    body = (
      <ResultStage
        code={code}
        view={view}
        opponentHere={othersOnline === null || othersOnline > 0}
        refresh={refresh}
        onFailure={fail}
      />
    );
  }

  return (
    <>
      <ScreenFade screen={screen}>{body}</ScreenFade>
      {/* the battle stacks it with its own toasts */}
      {toast && screen !== "battle" && <div className="mb-toast-dock">{toast}</div>}
    </>
  );
}
