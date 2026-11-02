"use client";

import { useCallback, useEffect, useReducer, useState } from "react";
import {
  AbilityCard,
  Board,
  Legend,
  SHIPS,
  ShotLog,
  TurnIndicator,
  TurnTimer,
} from "@/components/game";
import { Countdown } from "@/components/feedback/Countdown";
import { SunkMessage } from "@/components/feedback/SunkMessage";
import { Button, Dialog, Toast } from "@/components/ui";
import { useCountdown } from "@/hooks/useCountdown";
import { TURN_TIME_LIMIT_SECONDS } from "@/lib/config";
import { GameType } from "@/lib/enums";
import { createGameFixture } from "@/fixtures/game.fixture";
import {
  ENEMY_FLEET,
  OPPONENT_NAME,
  afloatCount,
  battleReducer,
  createBattleState,
  marksFor,
  revealedEnemyShips,
  toPlacement,
} from "./battleDemo";
import { SCREEN, ScreenBar } from "./chrome";

const TURN_SECONDS = TURN_TIME_LIMIT_SECONDS[GameType.ORIGINAL];
// leave "Go!" on screen for a moment before the board unlocks
const GO_HOLD_MS = 500;
// Teddy "thinks" between shots so each one can be seen landing
const OPPONENT_DELAY_MS = 900;
const NOTICE_MS = 4000;

// a fresh countdown per turn: the caller remounts it with a new key when the turn changes
function TurnClock({ size }: { size?: "lg" | "sm" }) {
  const { secondsLeft } = useCountdown(TURN_SECONDS * 1000);
  return <TurnTimer seconds={secondsLeft} total={TURN_SECONDS} size={size} />;
}

// sample battle from fixtures/game.fixture.ts: you fire at a hidden demo fleet, Teddy follows a script
export function BattleScreen() {
  const [state, dispatch] = useReducer(battleReducer, undefined, () => createBattleState(createGameFixture()));
  const [armed, setArmed] = useState(false);
  const [forfeitOpen, setForfeitOpen] = useState(false);
  const { phase, myShots, enemyShots, ownFleet, sunkNotice, winner } = state;

  const start = useCallback(() => {
    setTimeout(() => dispatch({ type: "start" }), GO_HOLD_MS);
  }, []);

  // Teddy fires one shot per tick; a hit keeps his turn, so this runs again on the new shot count
  useEffect(() => {
    if (phase !== "opponent") return;
    const id = setTimeout(() => dispatch({ type: "opponentFire" }), OPPONENT_DELAY_MS);
    return () => clearTimeout(id);
  }, [phase, enemyShots.length]);

  useEffect(() => {
    if (!sunkNotice) return;
    const id = setTimeout(() => dispatch({ type: "dismissNotice" }), NOTICE_MS);
    return () => clearTimeout(id);
  }, [sunkNotice]);

  const started = phase !== "countdown";
  const yourTurn = phase === "you";
  const turnKey = `${phase}-${state.turn}`;
  const turnFor = phase === "opponent" ? "opponent" : "you";
  const abilityState = yourTurn ? (armed ? "armed" : "ready") : "unavailable";
  const enemyAfloat = afloatCount(ENEMY_FLEET, myShots);
  const ownAfloat = afloatCount(ownFleet, enemyShots);

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
            meta={`${enemyAfloat} of ${ENEMY_FLEET.length} afloat`}
            marks={marksFor(ENEMY_FLEET, myShots)}
            ships={revealedEnemyShips(myShots)}
            active={yourTurn}
            sweeping={yourTurn}
            lastShot={started ? myShots.at(-1) : undefined}
            cellSize="lg"
            onCellClick={(cell) => dispatch({ type: "fire", key: cell.key })}
          />
        </div>
        <div className="order-3 grid content-start gap-(--space-3) max-[480px]:justify-items-center min-[1200px]:order-none">
          <Board
            variant="own"
            title="Your waters"
            meta={`${ownAfloat} of ${ownFleet.length} afloat`}
            marks={marksFor(ownFleet, enemyShots)}
            ships={ownFleet.map((ship) => toPlacement(ship, enemyShots))}
            lastShot={started ? enemyShots.at(-1) : undefined}
            cellSize="sm"
          />
          <div className="max-[899px]:hidden">
            <Legend />
          </div>
        </div>

        {/* phones: everything needed on your turn in one strip, right under the board you fire at */}
        <section className="mb-strip order-2 min-[900px]:hidden" aria-label="Turn">
          <div className="flex items-center gap-(--space-3)">
            <TurnIndicator turn={turnFor} opponentName={OPPONENT_NAME} />
            <div className="min-w-0 flex-1">
              <TurnClock key={turnKey} size="sm" />
            </div>
          </div>
          <AbilityCard
            ability="line-scan"
            state={abilityState}
            onUse={() => setArmed(true)}
            onCancel={() => setArmed(false)}
            compact
          />
          <ShotLog opponentLabel={OPPONENT_NAME} entries={state.log.slice(-1)} />
        </section>

        {/* tablets and desktop: the full HUD column */}
        <div className="order-2 grid content-start gap-(--space-3) max-[899px]:hidden min-[900px]:max-[1199px]:grid-cols-2 min-[1200px]:order-none">
          <TurnIndicator turn={turnFor} turnNumber={state.turn} opponentName={OPPONENT_NAME} />
          <TurnClock key={turnKey} />
          <AbilityCard
            ability="line-scan"
            state={abilityState}
            onUse={() => setArmed(true)}
            onCancel={() => setArmed(false)}
          />
          <ShotLog opponentLabel={OPPONENT_NAME} maxHeight={120} entries={[...state.log]} />
        </div>

        {/* phones: the full log and the key to the marks, folded away under your board */}
        <details className="order-4 min-[900px]:hidden">
          <summary className="mb-label cursor-pointer py-(--space-2)">Shot log and key</summary>
          <div className="grid gap-(--space-3) pt-(--space-2)">
            <ShotLog opponentLabel={OPPONENT_NAME} maxHeight={160} entries={[...state.log]} />
            <Legend />
          </div>
        </details>
      </main>

      {phase === "countdown" && (
        <div className="mb-countdown-overlay">
          <Countdown onComplete={start} />
        </div>
      )}

      <div className="mb-toast-dock">
        {sunkNotice && (
          <SunkMessage
            shipName={SHIPS[sunkNotice.ship].name}
            by={sunkNotice.by}
            opponentName={OPPONENT_NAME}
            onClose={() => dispatch({ type: "dismissNotice" })}
          />
        )}
        {winner && !sunkNotice && (
          <Toast tone={winner === "you" ? "sonar" : "neutral"} icon={winner === "you" ? "check" : "flag"}>
            {winner === "you" ? "Fleet destroyed. You win." : `${OPPONENT_NAME} wins. Your fleet is gone.`}
          </Toast>
        )}
      </div>

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
        <p>{OPPONENT_NAME} wins and the result is recorded. You can still ask for a rematch.</p>
      </Dialog>
    </div>
  );
}
