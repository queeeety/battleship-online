import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import type { Game } from "../controllers/Game";
import type { PlayerView } from "../controllers/Server";
import { HumanPlayer } from "../entities/players/HumanPlayer";
import type { Coordinate } from "../entities/board/Coordinate";
import type { Ability } from "../abilities/Ability";
import { getMyState, reportDisconnect } from "../server/actions/battle";
import type { BattleResult } from "../server/actions/battle";

type Channel = RealtimeChannel;

export type PrivatePayload =
    | { kind: "scanResult"; cells: Coordinate[] }
    | { kind: "abilityOffer"; current: Ability; drawn: Ability };

export type WirePrivatePayload =
    | { kind: "scanResult"; cells: { row: number; col: number }[] }
    | { kind: "abilityOffer"; current: string; drawn: string };

/** What the database trigger broadcasts. Enums are database text, e.g. "in_progress". */
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

export interface NetworkListener
{
    // fast path, e.g. to animate a shot straight away
    onBroadcast?(update: GameBroadcast): void;
    // the truth, refetched after every broadcast and reconnect
    onState?(view: PlayerView): void;
    onError?(error: string): void;
    onPresence?(onlineSessionIds: string[]): void;
    onDisconnect?(p: HumanPlayer): void;
    onPrivate?(payload: WirePrivatePayload): void;
}

type FetchState = (code: string) => Promise<BattleResult<PlayerView>>;
type ReportLeft = (code: string) => Promise<BattleResult<null>>;

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
    private reportLeft: ReportLeft;
    private code: string | null;

    constructor(client: SupabaseClient, listener: NetworkListener = {}, fetchState: FetchState = getMyState, reportLeft: ReportLeft = reportDisconnect)
    {
        this.channel = null;
        this.privateChannel = null;
        this.client = client;
        this.listener = listener;
        this.fetchState = fetchState;
        this.reportLeft = reportLeft;
        this.code = null;
    }

    /** Every broadcast and (re)connect triggers a resync, so a dropped message never leaves the screen stale. */
    public async subscribe(code: string): Promise<void>
    {
        await this.unsubscribe();
        this.code = code;
        await this.client.realtime.setAuth();
        const { data } = await this.client.auth.getClaims();
        const me = data?.claims.sub;

        this.channel = this.client.channel(`game:${code}`, { config: { private: true } })
            .on("broadcast", { event: "game_updated" }, ({ payload }) =>
            {
                this.listener.onBroadcast?.(payload as GameBroadcast);
                void this.resync(code);
            })
            .on("presence", { event: "sync" }, () => this.reportPresence())
            .on<{ sessionId: string; name: string }>("presence", { event: "leave" }, ({ leftPresences }) =>
            {
                // only a leave counts; someone who never tracked presence isn't reported
                for (const left of leftPresences)
                {
                    if (left.sessionId === me) continue;
                    void this.reportLeft(code);
                    this.onDisconnect(new HumanPlayer(left.name, left.sessionId));
                }
            })
            .subscribe(status => { if (status === "SUBSCRIBED") void this.resync(code); });

        if (me)
        {
            this.privateChannel = this.client.channel(`game:${code}:${me}`, { config: { private: true } })
                .on("broadcast", { event: "private" }, ({ payload }) => this.listener.onPrivate?.(payload as WirePrivatePayload))
                .subscribe();
        }
    }

    public async unsubscribe(): Promise<void>
    {
        for (const ch of [this.channel, this.privateChannel])
        {
            if (ch) await this.client.removeChannel(ch);
        }
        this.channel = null;
        this.privateChannel = null;
    }

    /** The database trigger broadcasts after every save instead. */
    public broadcast(g: Game): void
    {
        throw new Error(`Game ${g.getId()} is broadcast by the database trigger, not by NetworkHandler`);
    }

    public async trackPresence(p: HumanPlayer): Promise<void>
    {
        if (!this.channel) throw new Error("Subscribe before tracking presence");
        await this.channel.track({ sessionId: p.getSessionId(), name: p.getName() });
    }

    public onDisconnect(p: HumanPlayer): void
    {
        this.listener.onDisconnect?.(p);
    }

    /** Server side, on game:{code}:{sessionId}. */
    public async sendPrivate(p: HumanPlayer, payload: PrivatePayload, code: string | null = this.code): Promise<void>
    {
        if (!code) throw new Error("No game code to send on");
        const wire: WirePrivatePayload = payload.kind === "scanResult"
            ? { kind: "scanResult", cells: payload.cells.map(c => c.toRowCol()) }
            : { kind: "abilityOffer", current: payload.current.getName(), drawn: payload.drawn.getName() };

        const result = await this.client.channel(`game:${code}:${p.getSessionId()}`, { config: { private: true } }).httpSend("private", wire);
        if (!result.success) throw new Error(`Private message failed: ${result.error}`);
    }

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
