import type { PlayerView, ShotView } from "../controllers/Server";
import { GameState } from "../enums";
import { SHOT_SOUNDS, type SoundName } from "./AudioManager";

/** The parts of a PlayerView that decide which sound plays. result and gameState are optional so small demos can leave them out. */
export type SoundState = Pick<PlayerView, "yourShots" | "opponentShots" | "yourTurn">
    & Partial<Pick<PlayerView, "result" | "gameState">>;

/**
 * Music plays only during the battle, the one screen with the Sound menu for now,
 * so nobody hears music they can't turn off. Once every screen has the menu this can widen.
 */
export function musicWanted(view: SoundState | null): boolean
{
    return view !== null && view.gameState === GameState.IN_PROGRESS && !view.result;
}

// higher wins when one update brings several new shots
const SHOT_SOUND_RANK: Readonly<Partial<Record<SoundName, number>>> = {
    miss: 0,
    hit: 1,
    sunk: 2
};

function squareKey(shot: ShotView): string
{
    return `${shot.row},${shot.col}`;
}

// a re-fetch sends the same shots again, so compare squares, not list length
function newShots(prev: readonly ShotView[], next: readonly ShotView[]): ShotView[]
{
    const seen = new Set(prev.map(squareKey));
    return next.filter(shot => !seen.has(squareKey(shot)));
}

function loudestShotSound(shots: readonly ShotView[]): SoundName | null
{
    let best: SoundName | null = null;
    for (const shot of shots) {
        const sound = SHOT_SOUNDS[shot.result];
        if (best === null || (SHOT_SOUND_RANK[sound] ?? 0) > (SHOT_SOUND_RANK[best] ?? 0)) {
            best = sound;
        }
    }
    return best;
}

// the update that ends the game, however it ended (last ship sunk, forfeit, timeout)
function endSound(prev: SoundState, next: SoundState): SoundName | null
{
    if (prev.result || !next.result) {
        return null;
    }
    return next.result.won ? "win" : "lose";
}

/**
 * Picks the one sound to play when the view changes from prev to next.
 * First load (prev null) is silent so old shots never replay.
 * The game ending beats the shot that ended it.
 */
export function soundForUpdate(prev: SoundState | null, next: SoundState): SoundName | null
{
    if (prev === null) {
        return null;
    }
    const ending = endSound(prev, next);
    if (ending !== null) {
        return ending;
    }
    const shots = [
        ...newShots(prev.yourShots, next.yourShots),
        ...newShots(prev.opponentShots, next.opponentShots)
    ];
    const shotSound = loudestShotSound(shots);
    if (shotSound !== null) {
        return shotSound;
    }
    return !prev.yourTurn && next.yourTurn ? "turn" : null;
}
