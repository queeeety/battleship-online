import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import type { Game } from "../controllers/Game";
import type { PlayerView } from "../controllers/Server";
import { HumanPlayer } from "../entities/players/HumanPlayer";
import type { Coordinate } from "../entities/board/Coordinate";
import type { Ability } from "../abilities/Ability";
import { getMyState } from "../server/actions/battle";
import type { BattleResult } from "../server/actions/battle";

type Channel = RealtimeChannel;

export type PrivatePayload =
    | { kind: "scanResult"; cells: Coordinate[] }
    | { kind: "abilityOffer"; current: Ability; drawn: Ability };

/** PrivatePayload as plain JSON, the form it travels in. */
export type WirePrivatePayload =
    | { kind: "scanResult"; cells: { row: number; col: number }[] }
    | { kind: "abilityOffer"; current: string; drawn: string };

/**
 * The public state the database trigger broadcasts after every write (see the stage 5 migration).
 * Enums are their database text, e.g. game_state "in_progress", shot result "hit".
 */
export interface GameBroadcast
{
    code: string;
    lobby_status: string;
    game_type: string;
    game_state: string | null;
    player1_name: string;
    player2_name: string | null;
    ready_p1: boolean;
    ready_p2: boolean;
    disconnected_at_p1: string | null;
    disconnected_at_p2: string | null;
    turn: 1 | 2 | null;
    turn_started_at: string | null;
    double_shot_active: boolean;
    winner: 1 | 2 | null;
    end_reason: string | null;
    finished_at: string | null;
    shots_p1: { row: number; col: number; result: string; firedAt?: string; sunkShipName?: string | null }[];
    shots_p2: { row: number; col: number; result: string; firedAt?: string; sunkShipName?: string | null }[];
    rematch_by: 1 | 2 | null;
    rematch_status: string;
    updated_at: string;
}

/** What the screens get told. Every callback is optional. */
export interface NetworkListener
{
    // fast path: the broadcast as it arrives, e.g. to animate the last shot straight away
    onBroadcast?(update: GameBroadcast): void;
    // the truth: refetched with getMyState after every broadcast and reconnect
    onState?(view: PlayerView): void;
    onError?(error: string): void;
    onPresence?(onlineSessionIds: string[]): void;
    onDisconnect?(p: HumanPlayer): void;
    onPrivate?(payload: WirePrivatePayload): void;
}

type FetchState = (code: string) => Promise<BattleResult<PlayerView>>;

/**
 * Boundary class for the network.
 * Owns the realtime channel for one game, pushes state and tracks who is connected.
 * Broadcasts are just hints - on reconnect we refetch from the server.
 */
export class NetworkHandler
{
    private channel: Channel | null;
    private privateChannel: Channel | null;
    private client: SupabaseClient;
    private listener: NetworkListener;
    private fetchState: FetchState;
    private code: string | null;

    // the browser passes its client; tests pass fakes
    constructor(client: SupabaseClient, listener: NetworkListener = {}, fetchState: FetchState = getMyState)
    {
        this.channel = null;
        this.privateChannel = null;
        this.client = client;
        this.listener = listener;
        this.fetchState = fetchState;
        this.code = null;
    }

    /**
     * Joins game:{code} and this player's private channel. Each broadcast goes to onBroadcast
     * straight away, then every broadcast and (re)connect triggers a resync for onState,
     * so a dropped message never leaves the screen stale.
     */
    public async subscribe(code: string): Promise<void>
    {
        await this.unsubscribe();
        this.code = code;
        await this.client.realtime.setAuth();

        this.channel = this.client.channel(`game:${code}`, { config: { private: true } })
            .on("broadcast", { event: "game_updated" }, ({ payload }) =>
            {
                this.listener.onBroadcast?.(payload as GameBroadcast);
                void this.resync(code);
            })
            .on("presence", { event: "sync" }, () => this.reportPresence())
            .on<{ sessionId: string; name: string }>("presence", { event: "leave" }, ({ leftPresences }) =>
            {
                for (const left of leftPresences) this.onDisconnect(new HumanPlayer(left.name, left.sessionId));
            })
            .subscribe(status => { if (status === "SUBSCRIBED") void this.resync(code); });

        const { data } = await this.client.auth.getClaims();
        const me = data?.claims.sub;
        if (me)
        {
            this.privateChannel = this.client.channel(`game:${code}:${me}`, { config: { private: true } })
                .on("broadcast", { event: "private" }, ({ payload }) => this.listener.onPrivate?.(payload as WirePrivatePayload))
                .subscribe();
        }
    }

    /** Leaves both channels, e.g. when the screen closes. */
    public async unsubscribe(): Promise<void>
    {
        for (const ch of [this.channel, this.privateChannel])
        {
            if (ch) await this.client.removeChannel(ch);
        }
        this.channel = null;
        this.privateChannel = null;
    }

    /** Not needed: the database trigger broadcasts after every save, so nothing can forget to. */
    public broadcast(g: Game): void
    {
        throw new Error(`Game ${g.getId()} is broadcast by the database trigger, not by NetworkHandler`);
    }

    /** Announces this player on the game channel so the other one can see they're connected. */
    public async trackPresence(p: HumanPlayer): Promise<void>
    {
        if (!this.channel) throw new Error("Subscribe before tracking presence");
        await this.channel.track({ sessionId: p.getSessionId(), name: p.getName() });
    }

    /** Called when a player's presence drops; passes it on to the screen. */
    public onDisconnect(p: HumanPlayer): void
    {
        this.listener.onDisconnect?.(p);
    }

    /** Server side: sends a payload that only player p receives, on game:{code}:{sessionId}. */
    public async sendPrivate(p: HumanPlayer, payload: PrivatePayload, code: string | null = this.code): Promise<void>
    {
        if (!code) throw new Error("No game code to send on");
        const wire: WirePrivatePayload = payload.kind === "scanResult"
            ? { kind: "scanResult", cells: payload.cells.map(c => c.toRowCol()) }
            : { kind: "abilityOffer", current: payload.current.getName(), drawn: payload.drawn.getName() };

        const result = await this.client.channel(`game:${code}:${p.getSessionId()}`, { config: { private: true } }).httpSend("private", wire);
        if (!result.success) throw new Error(`Private message failed: ${result.error}`);
    }

    /** Refetches this player's view with getMyState and hands it to the screen. */
    public async resync(code: string): Promise<void>
    {
        const result = await this.fetchState(code);
        if (result.ok) this.listener.onState?.(result.data);
        else this.listener.onError?.(result.error);
    }

    private reportPresence(): void
    {
        if (!this.channel) return;
        const state = this.channel.presenceState<{ sessionId: string }>();
        const online = Object.values(state).flat().map(entry => entry.sessionId);
        this.listener.onPresence?.([...new Set(online)]);
    }
}
