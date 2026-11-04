"use client";

import { useEffect, useMemo, useReducer, useState } from "react";
import type { BoardProps, ShipPlacement } from "@/components/game/Board";
import {
    abilityIdFromName,
    coordKey,
    shipTypeFromName,
    type AbilityId,
    type CellMark
} from "@/components/game/data";
import { DoubleShot, LineScan, RadarSweep, Reroute } from "@/lib/abilities";
import { createAbility } from "@/lib/abilities/registry";
import { AbilityCard, scannedSquares, type AbilityBoard } from "@/lib/boundary/AbilityCard";
import { Board, Coordinate, type BoardSnapshot } from "@/lib/entities/board";
import { Orientation } from "@/lib/enums";
import type { AbilityRequest } from "@/lib/server/RequestValidator";

type Square = { row: number; col: number };
type Cell = { x: number; y: number; key: string };

export interface AbilityTargetingInput {
    /** The server's names, e.g. "Radar Sweep", as in PlayerView. */
    heldAbility: string | null;
    offeredAbility: string | null;
    yourTurn: boolean;
    doubleShotActive: boolean;
    /** Your fleet and the shots fired at it (PlayerView.yourBoard). */
    yourBoard: BoardSnapshot;
    /** Your shots at the enemy (PlayerView.yourShots). */
    yourShots: Square[];
    /** Ship squares your scans found and nobody has shot yet (PlayerView.revealedSquares). */
    revealedSquares: Square[];
    /** Sends the ability; resolve true once the server took it (useAbility's ok). */
    onUse: (request: AbilityRequest, target?: Square) => Promise<boolean> | boolean;
    /** Answers the keep-or-replace prompt (chooseAbility). */
    onChoose: (keep: boolean) => unknown;
}

export interface AbilityTargeting {
    /** Props for <AbilityCard>. */
    card: {
        ability: AbilityId | null;
        state: "ready" | "armed" | "unavailable";
        onUse: () => void;
        onCancel: () => void;
    };
    /** One line on what to do next, or why the ability can't be used. Show it in a live region. */
    hint: string | null;
    /** Props for <AbilityDraw> inside a Dialog; null when there's nothing to answer. */
    offer: { current: AbilityId; drawn: AbilityId; onKeep: () => void; onReplace: () => void } | null;
    /** contact and clear marks from your scans. Spread your shot marks after these so they win. */
    scanMarks: Record<string, CellMark>;
    /** Spread onto the enemy board after its own props: takes over clicks while a scan is armed. */
    targetBoardProps: Partial<BoardProps>;
    /** Spread onto your own board: takes clicks while Reroute is armed. */
    ownBoardProps: Partial<BoardProps>;
    /** The rerouted ship's ghost at the hovered square, to add to your own board's ships. */
    ownGhost: ShipPlacement[];
}

// a board snapshot as a stable string, so a fresh-but-equal prop doesn't rebuild the Board
function useBoard(snapshot: BoardSnapshot): Board
{
    const key = JSON.stringify(snapshot);
    return useMemo(() => Board.fromSnapshot(JSON.parse(key) as BoardSnapshot), [key]);
}

const keyOf = (c: Coordinate) => coordKey(c.getX(), c.getY());

/**
 * Connects the AbilityCard boundary class to the battle screen: the card, the keep-or-replace
 * prompt, targeting on either board and the scan marks. Server-agnostic: pass useAbility and
 * chooseAbility for multiplayer, or Game.applyAbility and resolveOffer for the AI game.
 */
export function useAbilityTargeting(input: AbilityTargetingInput): AbilityTargeting
{
    const { heldAbility, offeredAbility, yourTurn, doubleShotActive, yourBoard, yourShots, revealedSquares, onUse, onChoose } = input;

    const ownBoard = useBoard(yourBoard);
    const enemyBoard = useBoard({ ships: [], shots: yourShots });

    // a fresh card whenever the ability or the offer changes, so stale targeting never carries over
    const card = useMemo(() =>
    {
        const c = new AbilityCard();
        c.show(heldAbility ? createAbility(heldAbility) : null);
        const current = c.getAbility();
        const drawn = offeredAbility ? createAbility(offeredAbility) : null;
        if (current && drawn) c.showKeepOrReplace(current, drawn);
        return c;
    }, [heldAbility, offeredAbility]);
    // the turn ended (timeout or a Double Shot follow-up): drop targeting
    if (!yourTurn && card.isArmed()) card.cancel();

    // the card is a plain object, so changes to it ask for a render by hand
    const [, rerender] = useReducer((n: number) => n + 1, 0);
    const [hover, setHover] = useState<{ board: AbilityBoard; x: number; y: number } | null>(null);
    const [busy, setBusy] = useState(false);
    const [scanned, setScanned] = useState<string[]>([]);

    const ability = card.getAbility();
    const armed = card.isArmed() && !busy;
    const armedOn: AbilityBoard | null = armed ? card.targetBoard() : null;

    // Escape cancels, R turns Line Scan between row and column or rotates the rerouted ship
    useEffect(() =>
    {
        if (!armed) return;
        function onKey(e: KeyboardEvent)
        {
            const field = e.target as HTMLElement | null;
            if (field?.closest("input, textarea, select, [contenteditable]")) return;
            if (e.key === "Escape") { card.cancel(); rerender(); }
            else if (e.key === "r" || e.key === "R") { card.rotate(); rerender(); }
        }
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [armed, card]);

    let unavailable: string | null = null;
    if (ability)
    {
        if (!yourTurn) unavailable = "You can use it on your turn.";
        else if (busy) unavailable = "Sending…";
        else if (ability instanceof DoubleShot && doubleShotActive) unavailable = "Double Shot is already active this turn.";
        else if (ability instanceof Reroute && !ownBoard.getShips().some(s => ability.canMove(ownBoard, s)))
        {
            unavailable = "None of your ships can move: each one is damaged or boxed in.";
        }
    }

    async function send(target?: Coordinate)
    {
        const request = card.toRequest();
        setBusy(true);
        try
        {
            const ok = await onUse(request, target?.toRowCol());
            if (ok && target)
            {
                const keys = scannedSquares(request, enemyBoard, target).map(keyOf);
                if (keys.length > 0) setScanned(prev => [...new Set([...prev, ...keys])]);
            }
            if (ok) card.cancel();
        }
        finally
        {
            setBusy(false);
            rerender();
        }
    }

    function use()
    {
        if (!ability || unavailable) return;
        if (card.arm() === "fire-now") void send();
        else rerender();
    }

    function cancel()
    {
        card.cancel();
        setHover(null);
        rerender();
    }

    function onTargetClick(cell: Cell)
    {
        const t = new Coordinate(cell.x, cell.y);
        if (card.isValidTarget(enemyBoard, t)) void send(t);
    }

    // Reroute: a click on a valid square moves the selected ship, a click on a ship selects it
    function onOwnClick(cell: Cell)
    {
        const t = new Coordinate(cell.x, cell.y);
        if (card.getSelectedShip() && card.isValidTarget(ownBoard, t)) { void send(t); return; }
        const ship = ownBoard.getCell(t).getShip();
        if (ship && card.selectShip(ownBoard, ship)) rerender();
    }

    function hoverOn(board: AbilityBoard)
    {
        return (cell: Cell | null) => setHover(cell ? { board, x: cell.x, y: cell.y } : null);
    }

    // what the armed ability would cover from the hovered square
    let highlight: BoardProps["highlight"];
    let ownGhost: ShipPlacement[] = [];
    if (armedOn && hover?.board === armedOn)
    {
        const board = armedOn === "own" ? ownBoard : enemyBoard;
        const t = new Coordinate(hover.x, hover.y);
        const preview = card.previewAt(board, t);
        if (preview) highlight = { keys: preview.squares.map(keyOf), valid: preview.valid };

        const ship = card.getSelectedShip();
        const type = ship && shipTypeFromName(ship.getName());
        if (preview && type)
        {
            ownGhost = [{
                type,
                x: t.getX(),
                y: t.getY(),
                orientation: card.getRerouteOrientation() === Orientation.HORIZONTAL ? "horizontal" : "vertical",
                ghost: preview.valid ? "valid" : "invalid"
            }];
        }
    }
    // a selected ship with nowhere hovered yet stays outlined so it's clear which one moves
    if (armedOn === "own" && !highlight && card.getSelectedShip())
    {
        highlight = { keys: card.getSelectedShip()!.getCoordinates().map(keyOf), valid: true };
    }

    const shot = new Set(yourShots.map(s => coordKey(s.col, s.row)));
    const contacts = new Set(revealedSquares.map(s => coordKey(s.col, s.row)));
    const scanMarks: Record<string, CellMark> = {};
    for (const key of scanned) if (!shot.has(key)) scanMarks[key] = contacts.has(key) ? "contact" : "clear";
    for (const key of contacts) if (!shot.has(key)) scanMarks[key] = "contact";

    const offer = card.getOffer();
    const currentId = offer && abilityIdFromName(offer.current.getName());
    const drawnId = offer && abilityIdFromName(offer.drawn.getName());

    function answer(keep: boolean)
    {
        card.answerOffer(keep);
        rerender();
        void onChoose(keep);
    }

    return {
        card: {
            ability: abilityIdFromName(ability?.getName() ?? null),
            state: armed ? "armed" : unavailable ? "unavailable" : "ready",
            onUse: use,
            onCancel: cancel
        },
        hint: armed ? hintFor(card) : unavailable,
        offer: currentId && drawnId
            ? { current: currentId, drawn: drawnId, onKeep: () => answer(true), onReplace: () => answer(false) }
            : null,
        scanMarks,
        targetBoardProps: armedOn === "target"
            ? { active: true, targeting: true, sweeping: false, highlight, onCellClick: onTargetClick, onCellHover: hoverOn("target") }
            : {},
        ownBoardProps: armedOn === "own"
            ? { active: true, targeting: true, highlight, onCellClick: onOwnClick, onCellHover: hoverOn("own") }
            : {},
        ownGhost
    };
}

function hintFor(card: AbilityCard): string
{
    const a = card.getAbility();
    if (a instanceof RadarSweep) return "Pick the top-left square of a 3×3 area to scan. Esc cancels.";
    if (a instanceof LineScan)
    {
        return card.isLineRow()
            ? "Pick a square to scan its row. R switches to a column. Esc cancels."
            : "Pick a square to scan its column. R switches to a row. Esc cancels.";
    }
    if (a instanceof Reroute)
    {
        const ship = card.getSelectedShip();
        return ship
            ? `Pick where your ${ship.getName()} starts (its top or left end). R rotates. Esc cancels.`
            : "Pick one of your undamaged ships to move. Esc cancels.";
    }
    return "Esc cancels.";
}
