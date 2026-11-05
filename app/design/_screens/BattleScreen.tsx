"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { SHIPS, coordKey, TurnTimer } from "@/components/game";
import { Countdown } from "@/components/feedback/Countdown";
import { SunkMessage } from "@/components/feedback/SunkMessage";
import { Button, Toast } from "@/components/ui";
import { BattleView } from "@/components/screens/BattleView";
import { useAbilityTargeting } from "@/hooks/useAbilityTargeting";
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
  openSquares,
  revealedEnemyShips,
  toPlacement,
} from "./battleDemo";
import { boardSnapshot, randomAbilityName, squaresOf } from "./abilityDemo";

const TURN_SECONDS = TURN_TIME_LIMIT_SECONDS[GameType.ORIGINAL];
// leave "Go!" on screen for a moment before the board unlocks
const GO_HOLD_MS = 500;
// Teddy "thinks" between shots so each one can be seen landing
const OPPONENT_DELAY_MS = 900;
const NOTICE_MS = 4000;

interface TurnClockProps {
  size?: "lg" | "sm";
  /** Called once when the clock reaches 0. */
  onExpire?: () => void;
}

// a fresh countdown per shot: the caller remounts it with a new key, which also resets `expired`
function TurnClock({ size, onExpire }: TurnClockProps) {
  const { secondsLeft, hasExpired } = useCountdown(TURN_SECONDS * 1000);
  const expired = useRef(false);

  // hasExpired stays true across renders, so guard to call onExpire once (same as Countdown)
  useEffect(() => {
    if (!hasExpired || expired.current) return;
    expired.current = true;
    onExpire?.();
  }, [hasExpired, onExpire]);

  return <TurnTimer seconds={secondsLeft} total={TURN_SECONDS} size={size} />;
}

// sample battle from fixtures/game.fixture.ts: you fire at a hidden demo fleet, Teddy follows a script
export function BattleScreen() {
  const [state, dispatch] = useReducer(battleReducer, undefined, () => createBattleState(createGameFixture()));
  const [forfeitOpen, setForfeitOpen] = useState(false);
  const { phase, myShots, enemyShots, ownFleet, sunkNotice, winner } = state;

  const start = useCallback(() => {
    setTimeout(() => dispatch({ type: "start" }), GO_HOLD_MS);
  }, []);

  // at 0 a random open square is fired for you, like Game.fireRandomShot; the reducer ignores it off your turn
  const autoFire = useCallback(() => {
    const open = openSquares(myShots);
    if (open.length === 0) return;
    dispatch({ type: "timeout", key: open[Math.floor(Math.random() * open.length)] });
  }, [myShots]);

  // Teddy fires one shot per tick; a hit keeps his turn, so this runs again on the new shot count
  useEffect(() => {
    if (phase !== "opponent") return;
    // the draw is only used if this shot sinks one of your ships
    const id = setTimeout(() => dispatch({ type: "opponentFire", draw: randomAbilityName(state.heldAbility) }), OPPONENT_DELAY_MS);
    return () => clearTimeout(id);
  }, [phase, enemyShots.length, state.heldAbility]);

  useEffect(() => {
    if (!sunkNotice) return;
    const id = setTimeout(() => dispatch({ type: "dismissNotice" }), NOTICE_MS);
    return () => clearTimeout(id);
  }, [sunkNotice]);

  const started = phase !== "countdown";
  const yourTurn = phase === "you";
  // the clock restarts after every resolved shot (tech design), so a hit that keeps the turn resets it too
  const turnKey = `${phase}-${state.turn}-${myShots.length + enemyShots.length}`;
  const turnFor = phase === "opponent" ? "opponent" : "you";
  // the same inputs PlayerView gives the real screen; dispatch stands in for the useAbility and chooseAbility actions
  const ability = useAbilityTargeting({
    heldAbility: state.heldAbility,
    offeredAbility: state.offeredAbility,
    yourTurn,
    doubleShotActive: state.doubleShotActive,
    yourBoard: boardSnapshot(ownFleet, enemyShots),
    yourShots: squaresOf(myShots),
    revealedSquares: squaresOf(state.revealed),
    onUse: (request, target) => {
      dispatch({ type: "useAbility", request, target: target && coordKey(target.col, target.row) });
      return true;
    },
    onChoose: (keep) => dispatch({ type: "chooseAbility", keep }),
  });
  const enemyAfloat = afloatCount(ENEMY_FLEET, myShots);
  const ownAfloat = afloatCount(ownFleet, enemyShots);

  return (
    <BattleView
      barLabel="Original · Lobby K7Q2XM"
      barExtra={
        // showcase only: draw as if one of your ships had sunk, to try the keep-or-replace prompt
        <Button size="sm" variant="ghost" onClick={() => dispatch({ type: "drawAbility", name: randomAbilityName(state.heldAbility) })}>
          Draw an ability
        </Button>
      }
      opponentName={OPPONENT_NAME}
      target={{
        meta: `${enemyAfloat} of ${ENEMY_FLEET.length} afloat`,
        marks: { ...ability.scanMarks, ...marksFor(ENEMY_FLEET, myShots) },
        ships: revealedEnemyShips(myShots),
        active: yourTurn,
        sweeping: yourTurn,
        lastShot: started ? myShots.at(-1) : undefined,
        onCellClick: (cell) => dispatch({ type: "fire", key: cell.key }),
        ...ability.targetBoardProps,
      }}
      own={{
        meta: `${ownAfloat} of ${ownFleet.length} afloat`,
        marks: marksFor(ownFleet, enemyShots),
        ships: [...ownFleet.map((ship) => toPlacement(ship, enemyShots)), ...ability.ownGhost],
        lastShot: started ? enemyShots.at(-1) : undefined,
        ...ability.ownBoardProps,
      }}
      turn={turnFor}
      turnNumber={state.turn}
      // both clocks stay mounted (CSS hides one), so only the large one auto-fires, or you'd lose two shots
      renderClock={(size) => <TurnClock key={`${turnKey}-${size}`} size={size} onExpire={size === "lg" ? autoFire : undefined} />}
      ability={{ card: ability.card, hint: ability.hint }}
      log={[...state.log]}
      overlay={
        phase === "countdown" && (
          <div className="mb-countdown-overlay">
            <Countdown onComplete={start} />
          </div>
        )
      }
      toasts={
        <>
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
        </>
      }
      offer={ability.offer}
      forfeit={{
        open: forfeitOpen,
        onOpen: () => setForfeitOpen(true),
        onClose: () => setForfeitOpen(false),
        onConfirm: () => setForfeitOpen(false),
      }}
    />
  );
}
