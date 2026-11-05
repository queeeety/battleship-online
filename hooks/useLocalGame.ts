"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BattleActions } from "@/components/screens/battleActions";
import {
    applyLocalAbility,
    computerMove,
    computerOf,
    fireIfExpired,
    humanOf,
    localView,
    newLocalGame,
    resumeAfterAway,
    startBattle,
    withScanned
} from "@/components/screens/localGame";
import type { Layout } from "@/components/screens/placement";
import type { WirePrivatePayload } from "@/lib/boundary/NetworkHandler";
import { Game, type GameSnapshot } from "@/lib/controllers/Game";
import type { PlayerView } from "@/lib/controllers/Server";
import { Coordinate } from "@/lib/entities/board";
import { Difficulty, GameState, GameType } from "@/lib/enums";
import type { BattleResult } from "@/lib/server/actions/battle";
import "@/utils/randomUUIDShim";

type Square = { row: number; col: number };

const SAVE_KEY = "mybattleship:vs-computer";
// the computer "thinks" between moves so each one can be seen landing
const COMPUTER_DELAY_MS = 900;

interface Saved {
    game: GameSnapshot;
    difficulty: Difficulty;
    scanned: Square[];
    /** The time since this is given back to the player to move. */
    savedAt?: number;
}

// the save is a convenience: a private window or blocked storage just means no resume
function load(): { game: Game; difficulty: Difficulty; scanned: Square[]; view: PlayerView } | null {
    try {
        const raw = localStorage.getItem(SAVE_KEY);
        if (!raw) return null;
        const saved = JSON.parse(raw) as Saved;
        const game = Game.fromJSON(saved.game);
        const scanned = saved.scanned ?? [];
        resumeAfterAway(game, saved.savedAt ?? 0);
        return { game, difficulty: saved.difficulty, scanned, view: localView(game, scanned) };
    } catch {
        // a save that can't be shown would break /play every time
        forget();
        return null;
    }
}

function save(saved: Saved): void {
    try {
        localStorage.setItem(SAVE_KEY, JSON.stringify(saved));
    } catch {
    }
}

function forget(): void {
    try {
        localStorage.removeItem(SAVE_KEY);
    } catch {
    }
}

const OK: BattleResult<null> = { ok: true, data: null };
const REFUSED: BattleResult<null> = { ok: false, error: "MOVE_REFUSED" };

export interface LocalGame {
    view: PlayerView | null;
    difficulty: Difficulty | null;
    start: (difficulty: Difficulty, gameType: GameType) => void;
    /** False if the layout isn't a full fleet. */
    ready: (layout: Layout) => boolean;
    actions: BattleActions;
    /** The computer's latest ability, shaped like the online private message. */
    lastPrivate: { payload: WirePrivatePayload } | null;
    playAgain: () => void;
    quit: () => void;
}

/** A game against the computer, saved to localStorage after every move. Client only. */
export function useLocalGame(): LocalGame {
    const [restored] = useState(load);
    const game = useRef<Game | null>(restored?.game ?? null);
    const scanned = useRef<Square[]>(restored?.scanned ?? []);
    const [difficulty, setDifficulty] = useState<Difficulty | null>(restored?.difficulty ?? null);
    const [view, setView] = useState<PlayerView | null>(restored?.view ?? null);
    const [lastPrivate, setLastPrivate] = useState<{ payload: WirePrivatePayload } | null>(null);
    const settings = useRef<Difficulty | null>(restored?.difficulty ?? null);

    const commit = useCallback(() => {
        const current = game.current;
        if (!current) return;
        setView(localView(current, scanned.current));
        if (settings.current !== null) {
            save({ game: current.toJSON(), difficulty: settings.current, scanned: scanned.current, savedAt: Date.now() });
        }
    }, []);

    const actions = useMemo<BattleActions>(() => {
        // as on the server: an expired turn takes its random shot first, and a refused move is undone
        function run(move: (g: Game) => void): Promise<BattleResult<null>> {
            const current = game.current;
            if (!current) return Promise.resolve(REFUSED);
            const expired = fireIfExpired(current);
            const before = { game: current.toJSON(), scanned: scanned.current };
            try {
                move(current);
            } catch {
                game.current = Game.fromJSON(before.game);
                scanned.current = before.scanned;
                if (expired) commit();
                return Promise.resolve(REFUSED);
            }
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
            claimTimeout: async () => {
                const current = game.current;
                if (!current || document.hidden || !fireIfExpired(current)) return false;
                commit();
                return true;
            }
        };
    }, [commit]);

    useEffect(() => {
        if (!view || view.gameState !== GameState.IN_PROGRESS || view.yourTurn) return;
        const id = setTimeout(() => {
            const current = game.current;
            // paused while hidden; coming back commits, which reschedules this
            if (!current || document.hidden) return;
            const computer = computerOf(current);
            if (current.getState() !== GameState.IN_PROGRESS || current.getCurrentTurn() !== computer) return;
            try {
                const moved = computerMove(current, scanned.current);
                scanned.current = moved.scanned;
                if (moved.used) setLastPrivate({ payload: { kind: "abilityUsed", by: computer.getName(), ability: moved.used } });
            } catch (e) {
                console.error("The computer couldn't move", e);
            }
            commit();
        }, COMPUTER_DELAY_MS);
        return () => clearTimeout(id);
    }, [view, commit]);

    // a hidden page pauses the game, and the time away is given back
    useEffect(() => {
        let hiddenAt: number | null = null;
        function onVisibility() {
            if (document.hidden) {
                hiddenAt = Date.now();
                commit();
            } else if (hiddenAt !== null) {
                if (game.current) resumeAfterAway(game.current, hiddenAt);
                hiddenAt = null;
                commit();
            }
        }
        document.addEventListener("visibilitychange", onVisibility);
        return () => document.removeEventListener("visibilitychange", onVisibility);
    }, [commit]);

    function start(level: Difficulty, gameType: GameType) {
        game.current = newLocalGame(level, gameType);
        scanned.current = [];
        settings.current = level;
        setDifficulty(level);
        commit();
    }

    return {
        view,
        difficulty,
        start,
        ready: (layout) => {
            const current = game.current;
            if (!current || current.getState() !== GameState.PLACEMENT) return false;
            try {
                startBattle(current, layout);
            } catch {
                return false;
            }
            commit();
            return true;
        },
        actions,
        lastPrivate,
        playAgain: () => {
            const current = game.current;
            if (current && settings.current !== null) start(settings.current, current.getGameType());
        },
        quit: () => {
            forget();
            game.current = null;
            scanned.current = [];
            settings.current = null;
            setDifficulty(null);
            setView(null);
        }
    };
}
