"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { ErrorToast } from "@/components/feedback/ErrorToast";
import { isToastFailure } from "@/components/feedback/ErrorState";
import { BattleStage } from "@/components/screens/BattleStage";
import type { BattleActions } from "@/components/screens/battleActions";
import {
  applyLocalAbility,
  computerMove,
  computerOf,
  humanOf,
  localView,
  newLocalGame,
  startBattle,
  withScanned,
} from "@/components/screens/localGame";
import { randomLayout } from "@/components/screens/placement";
import { Button } from "@/components/ui";
import type { WirePrivatePayload } from "@/lib/boundary/NetworkHandler";
import { createAbility } from "@/lib/abilities/registry";
import { Game } from "@/lib/controllers/Game";
import type { PlayerView } from "@/lib/controllers/Server";
import { Coordinate } from "@/lib/entities/board";
import { Difficulty, GameState, GameType } from "@/lib/enums";
import type { BattleFailure, BattleResult } from "@/lib/server/actions/battle";
import { ShowcaseStrip } from "./chrome";

type Square = { row: number; col: number };

const ABILITY_NAMES = ["Radar Sweep", "Line Scan", "Double Shot", "Reroute"];
const OK: BattleResult<null> = { ok: true, data: null };
const REFUSED: BattleResult<null> = { ok: false, error: "MOVE_REFUSED" };

// a battle with your turn first; Beginner's 30 s turns leave time to look around
function freshGame(): Game {
  const game = newLocalGame(Difficulty.NORMAL, GameType.BEGINNER);
  startBattle(game, randomLayout());
  if (game.getCurrentTurn() !== humanOf(game)) game.switchTurn();
  return game;
}

// it's always your turn here: whatever passes it to the computer hands it straight back
function handBack(game: Game) {
  if (game.getState() === GameState.IN_PROGRESS && game.getCurrentTurn() !== humanOf(game)) game.switchTurn();
}

function snapshot(game: Game, scanned: Square[]): { view: PlayerView; enemyFleet: PlayerView["opponentSunkShips"] } {
  return { view: localView(game, scanned), enemyFleet: computerOf(game).getBoard().toSnapshot().ships };
}

/**
 * A real battle against the computer, on lib's Game, for trying every ability: grant yourself
 * any of them, let the computer fire or sink one of your ships, and see its whole fleet.
 */
export function PlaygroundScreen() {
  const [first] = useState(freshGame);
  const game = useRef(first);
  const scanned = useRef<Square[]>([]);
  const [state, setState] = useState(() => snapshot(first, []));
  const [round, setRound] = useState(0);
  const [reveal, setReveal] = useState(true);
  const [lastPrivate, setLastPrivate] = useState<{ payload: WirePrivatePayload } | null>(null);
  const [failure, setFailure] = useState<BattleFailure | null>(null);

  const commit = useCallback(() => setState(snapshot(game.current, scanned.current)), []);

  const actions = useMemo<BattleActions>(() => {
    function run(move: (g: Game) => void): Promise<BattleResult<null>> {
      try {
        move(game.current);
      } catch {
        return Promise.resolve(REFUSED);
      }
      handBack(game.current);
      commit();
      return Promise.resolve(OK);
    }
    return {
      fireShot: (t) => run((g) => g.fireShot(humanOf(g), Coordinate.fromRowCol(t.row, t.col))),
      useAbility: (request, t) =>
        run((g) => {
          const found = applyLocalAbility(g, request, t).map((c) => c.toRowCol());
          scanned.current = withScanned(scanned.current, found);
        }),
      chooseAbility: (keep) => run((g) => humanOf(g).resolveOffer(keep)),
      forfeit: () => run((g) => g.forfeit(humanOf(g))),
      // no time limit here: a turn that runs out just starts again
      claimTimeout: async () => {
        const g = game.current;
        if (g.getState() !== GameState.IN_PROGRESS) return false;
        g.switchTurn();
        g.switchTurn();
        commit();
        return true;
      },
    };
  }, [commit]);

  const playing = state.view.gameState === GameState.IN_PROGRESS;

  function give(name: string) {
    const ability = createAbility(name);
    if (!ability || !playing) return;
    // holding one already makes this an offer, so the keep-or-replace prompt can be tried too
    humanOf(game.current).receiveAbility(ability);
    commit();
  }

  // the computer takes one action: a shot, or an ability it holds
  function enemyFires() {
    const g = game.current;
    if (!playing) return;
    g.switchTurn();
    const computer = computerOf(g);
    const moved = computerMove(g, scanned.current);
    scanned.current = moved.scanned;
    if (moved.used) setLastPrivate({ payload: { kind: "abilityUsed", by: computer.getName(), ability: moved.used } });
    handBack(g);
    commit();
  }

  // the computer sinks one of your ships, so you're handed an ability the way the game does it
  function sinkOneOfMine() {
    const g = game.current;
    const you = humanOf(g);
    const ship = you.getBoard().getShips().find((s) => !s.isSunk());
    if (!playing || !ship) return;
    g.switchTurn();
    for (const c of ship.getCoordinates()) {
      if (!you.getBoard().hasBeenTargeted(c) && g.getState() === GameState.IN_PROGRESS) g.fireShot(computerOf(g), c);
    }
    handBack(g);
    commit();
  }

  function newBoards() {
    game.current = freshGame();
    scanned.current = [];
    setLastPrivate(null);
    setFailure(null);
    setRound((n) => n + 1);
    commit();
  }

  const view = reveal ? { ...state.view, opponentSunkShips: state.enemyFleet } : state.view;

  return (
    <>
      <ShowcaseStrip name="Abilities playground" />
      <div className="flex flex-wrap items-center gap-(--space-2) border-b border-line bg-surface-100 px-(--space-4) py-(--space-2)">
        <span className="mb-label">Give me</span>
        {ABILITY_NAMES.map((name) => (
          <Button key={name} size="sm" disabled={!playing} onClick={() => give(name)}>
            {name}
          </Button>
        ))}
        <span className="mb-label ml-(--space-2)">Computer</span>
        <Button size="sm" disabled={!playing} onClick={enemyFires}>
          Fires once
        </Button>
        <Button size="sm" disabled={!playing} onClick={sinkOneOfMine}>
          Sinks one of my ships
        </Button>
        <span className="flex-1" />
        <label className="flex items-center gap-(--space-2) text-small">
          <input type="checkbox" checked={reveal} onChange={(e) => setReveal(e.target.checked)} />
          Show enemy fleet
        </label>
        <Button size="sm" variant="ghost" icon="rotate" onClick={newBoards}>
          New boards
        </Button>
      </div>
      <BattleStage
        key={round}
        view={view}
        actions={actions}
        barLabel="Playground · always your turn"
        opponentKind="ai"
        lastPrivate={lastPrivate}
        refresh={() => {}}
        onFailure={setFailure}
        failure={failure && isToastFailure(failure) && <ErrorToast error={failure} onClose={() => setFailure(null)} />}
      />
    </>
  );
}
