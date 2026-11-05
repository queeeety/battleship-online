"use client";

import { useCallback, useEffect, useEffectEvent, useRef } from "react";
import { NetworkHandler, type WirePrivatePayload } from "@/lib/boundary/NetworkHandler";
import type { PlayerView } from "@/lib/controllers/Server";
import { HumanPlayer } from "@/lib/entities/players/HumanPlayer";
import { getMyState, keepLobbyOpen, reportDisconnect } from "@/lib/server/actions/battle";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { coalesce } from "@/utils/coalesce";
import { settle } from "@/utils/settle";
import "@/utils/randomUUIDShim";

export interface GameConnectionOptions {
    /** Off until getMyState has seated us: the realtime policies refuse anyone else. */
    enabled: boolean;
    name: string | null;
    onState: (view: PlayerView) => void;
    onError: (error: string) => void;
    onPrivate?: (payload: WirePrivatePayload) => void;
    /** Session ids of the others on the game's channel (your other tabs count as you). */
    onPresence?: (others: string[]) => void;
}

// Supabase keeps a removed channel until the server confirms it, and asking for the same topic
// meanwhile returns that dying channel. Each new connection waits for the last one to close.
let lastTeardown: Promise<unknown> = Promise.resolve();

/** Keeps a NetworkHandler subscribed to the game while `enabled`; refresh() refetches the view. */
export function useGameConnection(code: string, options: GameConnectionOptions): { refresh: () => void } {
    const { enabled, name } = options;
    const handlerRef = useRef<NetworkHandler | null>(null);

    const onState = useEffectEvent((view: PlayerView) => options.onState(view));
    const onError = useEffectEvent((error: string) => options.onError(error));
    const onPrivate = useEffectEvent((payload: WirePrivatePayload) => options.onPrivate?.(payload));
    const onPresence = useEffectEvent((others: string[]) => options.onPresence?.(others));

    useEffect(() => {
        if (!enabled || name === null) return;

        // after cleanup a late refetch must neither reach the page nor restart the host's heartbeat
        let closed = false;
        let sessionId: string | null = null;
        let you: HumanPlayer | null = null;
        let retracking = false;
        const client = createBrowserSupabase();
        const handler = new NetworkHandler(
            client,
            {
                onState: (view) => !closed && onState(view),
                onError: (error) => !closed && onError(error),
                onPrivate: (payload) => !closed && onPrivate(payload),
                onPresence: (online) => {
                    if (closed) return;
                    // realtime-js rejoins after a dropped connection but doesn't track us again
                    if (you && !retracking && !online.includes(you.getSessionId())) {
                        retracking = true;
                        void handler
                            .trackPresence(you)
                            .catch((e: unknown) => console.error("Couldn't rejoin presence", e))
                            .finally(() => {
                                retracking = false;
                            });
                    }
                    onPresence(online.filter((id) => id !== sessionId));
                }
            },
            {
                getMyState: coalesce((c: string) => settle(() => getMyState(c))),
                keepLobbyOpen: (c) => (closed ? Promise.resolve({ ok: true, data: false }) : settle(() => keepLobbyOpen(c))),
                reportDisconnect: (c) => settle(() => reportDisconnect(c))
            }
        );
        handlerRef.current = handler;

        // under Strict Mode the first run closes before it subscribes; the second waits for it
        const started = lastTeardown.then(async () => {
            if (closed) return false;
            const { data } = await client.auth.getClaims();
            sessionId = data?.claims.sub ?? null;
            await handler.subscribe(code);
            // don't wait for the channel to join (it may never): this also starts the host's heartbeat
            void handler.resync(code);
            if (sessionId && !closed) {
                const player = new HumanPlayer(name, sessionId);
                await handler.trackPresence(player);
                you = player;
            }
            return true;
        }).catch((e: unknown) => {
            console.error("Couldn't connect to the game", e);
            return true;
        });

        // a phone waking up or the network coming back: don't wait for the socket to notice
        function catchUp() {
            if (!closed && document.visibilityState === "visible") void handler.resync(code);
        }
        document.addEventListener("visibilitychange", catchUp);
        window.addEventListener("online", catchUp);

        return () => {
            closed = true;
            document.removeEventListener("visibilitychange", catchUp);
            window.removeEventListener("online", catchUp);
            if (handlerRef.current === handler) handlerRef.current = null;
            lastTeardown = started.then((subscribed) => (subscribed ? handler.unsubscribe() : undefined)).catch(() => undefined);
        };
    }, [code, enabled, name]);

    const refresh = useCallback(() => {
        void handlerRef.current?.resync(code);
    }, [code]);

    return { refresh };
}
