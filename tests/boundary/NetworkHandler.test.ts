import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { NetworkHandler } from "../../lib/boundary/NetworkHandler";
import { HumanPlayer } from "../../lib/entities/players";
import { Coordinate } from "../../lib/entities/board";
import { RadarSweep, LineScan } from "../../lib/abilities";
import type { PlayerView } from "../../lib/controllers/Server";

/**
 * A fake Supabase client whose channels remember their handlers, so a test can
 * play the part of Realtime: fire a broadcast, a presence change or a reconnect.
 */
function fakeRealtime(me: string | null = "me")
{
    type Handler = (payload: unknown) => void;
    interface FakeChannel { handlers: Map<string, Handler>; status?: (s: string) => void; presence: Record<string, unknown[]>; tracked: unknown[]; sent: unknown[] }
    const channels = new Map<string, FakeChannel>();
    const channel = (topic: string) =>
    {
        const ch: FakeChannel = channels.get(topic) ?? { handlers: new Map(), presence: {}, tracked: [], sent: [] };
        channels.set(topic, ch);
        const api = {
            on: (type: string, filter: { event: string }, handler: Handler) => { ch.handlers.set(`${type}:${filter.event}`, handler); return api; },
            subscribe: (status?: (s: string) => void) => { ch.status = status; return api; },
            track: async (payload: unknown) => { ch.tracked.push(payload); return "ok"; },
            presenceState: () => ch.presence,
            httpSend: async (_event: string, payload: unknown) => { ch.sent.push(payload); return { success: true }; }
        };
        return api;
    };
    const client = {
        realtime: { setAuth: vi.fn().mockResolvedValue(undefined) },
        auth: { getClaims: vi.fn().mockResolvedValue({ data: me ? { claims: { sub: me } } : null, error: null }) },
        channel: vi.fn(channel),
        removeChannel: vi.fn().mockResolvedValue("ok")
    } as unknown as SupabaseClient;

    // what Realtime would do
    const emit = (topic: string, key: string, payload: unknown = {}) => channels.get(topic)!.handlers.get(key)!(payload);
    const connect = (topic: string, status = "SUBSCRIBED") => channels.get(topic)!.status?.(status);
    return { client, channels, emit, connect };
}

const view = { code: "ABC234", seat: 1 } as PlayerView;

function setup(me: string | null = "me")
{
    const rt = fakeRealtime(me);
    const listener = { onBroadcast: vi.fn(), onState: vi.fn(), onError: vi.fn(), onPresence: vi.fn(), onDisconnect: vi.fn(), onPrivate: vi.fn() };
    const fetchState = vi.fn().mockResolvedValue({ ok: true, data: view });
    return { ...rt, listener, fetchState, net: new NetworkHandler(rt.client, listener, fetchState) };
}

describe("NetworkHandler.subscribe", () =>
{
    it("joins the private game channel and this player's own channel", async () =>
    {
        const { net, client, channels } = setup();
        await net.subscribe("ABC234");
        expect(client.realtime.setAuth).toHaveBeenCalled();
        expect([...channels.keys()]).toEqual(["game:ABC234", "game:ABC234:me"]);
        expect(client.channel).toHaveBeenCalledWith("game:ABC234", { config: { private: true } });
    });

    it("refetches the state once connected, and again after a reconnect", async () =>
    {
        const { net, connect, fetchState, listener } = setup();
        await net.subscribe("ABC234");
        connect("game:ABC234");
        connect("game:ABC234", "CHANNEL_ERROR");
        connect("game:ABC234");
        await vi.waitFor(() => expect(fetchState).toHaveBeenCalledTimes(2));
        expect(listener.onState).toHaveBeenCalledWith(view);
    });

    it("treats a broadcast as a hint and refetches rather than trusting its contents", async () =>
    {
        const { net, emit, fetchState, listener } = setup();
        await net.subscribe("ABC234");
        emit("game:ABC234", "broadcast:game_updated", { payload: { turn: 2 } });
        await vi.waitFor(() => expect(fetchState).toHaveBeenCalledWith("ABC234"));
        expect(listener.onState).toHaveBeenCalledWith(view);
    });

    it("hands the broadcast to the screen straight away, before the refetch finishes", async () =>
    {
        const { net, emit, fetchState, listener } = setup();
        fetchState.mockReturnValueOnce(new Promise(() => {}));   // a refetch that never finishes
        await net.subscribe("ABC234");
        const update = { code: "ABC234", turn: 2, shots_p1: [{ row: 4, col: 4, result: "miss" }] };
        emit("game:ABC234", "broadcast:game_updated", { payload: update });
        expect(listener.onBroadcast).toHaveBeenCalledWith(update);
        expect(listener.onState).not.toHaveBeenCalled();
    });

    it("skips the private channel when there's no session", async () =>
    {
        const { net, channels } = setup(null);
        await net.subscribe("ABC234");
        expect([...channels.keys()]).toEqual(["game:ABC234"]);
    });

    it("passes private messages to the screen", async () =>
    {
        const { net, emit, listener } = setup();
        await net.subscribe("ABC234");
        emit("game:ABC234:me", "broadcast:private", { payload: { kind: "abilityOffer", current: "Radar Sweep", drawn: "Line Scan" } });
        expect(listener.onPrivate).toHaveBeenCalledWith({ kind: "abilityOffer", current: "Radar Sweep", drawn: "Line Scan" });
    });

    it("leaves the old channels when subscribing to a new game", async () =>
    {
        const { net, client } = setup();
        await net.subscribe("ABC234");
        await net.subscribe("XYZ789");
        expect(client.removeChannel).toHaveBeenCalledTimes(2);
    });
});

describe("NetworkHandler presence", () =>
{
    it("tracks this player on the game channel", async () =>
    {
        const { net, channels } = setup();
        await net.subscribe("ABC234");
        await net.trackPresence(new HumanPlayer("Cian", "me"));
        expect(channels.get("game:ABC234")!.tracked).toEqual([{ sessionId: "me", name: "Cian" }]);
    });

    it("reports who is online when presence syncs", async () =>
    {
        const { net, channels, emit, listener } = setup();
        await net.subscribe("ABC234");
        channels.get("game:ABC234")!.presence = { a: [{ sessionId: "me" }], b: [{ sessionId: "them" }, { sessionId: "them" }] };
        emit("game:ABC234", "presence:sync");
        expect(listener.onPresence).toHaveBeenCalledWith(["me", "them"]);
    });

    it("calls onDisconnect with the player who left", async () =>
    {
        const { net, emit, listener } = setup();
        await net.subscribe("ABC234");
        emit("game:ABC234", "presence:leave", { leftPresences: [{ sessionId: "them", name: "Aoife" }] });
        const left = listener.onDisconnect.mock.calls[0][0] as HumanPlayer;
        expect(left.getSessionId()).toBe("them");
        expect(left.getName()).toBe("Aoife");
    });

    it("refuses to track presence before subscribing", async () =>
    {
        const { net } = setup();
        await expect(net.trackPresence(new HumanPlayer("Cian", "me"))).rejects.toThrow();
    });
});

describe("NetworkHandler.sendPrivate", () =>
{
    it("sends scan results as plain squares on the player's own channel", async () =>
    {
        const { net, channels } = setup();
        await net.sendPrivate(new HumanPlayer("Aoife", "them"), { kind: "scanResult", cells: [new Coordinate(3, 2)] }, "ABC234");
        expect(channels.get("game:ABC234:them")!.sent).toEqual([{ kind: "scanResult", cells: [{ row: 2, col: 3 }] }]);
    });

    it("sends an ability offer by name", async () =>
    {
        const { net, channels } = setup();
        await net.sendPrivate(new HumanPlayer("Aoife", "them"), { kind: "abilityOffer", current: new RadarSweep(), drawn: new LineScan() }, "ABC234");
        expect(channels.get("game:ABC234:them")!.sent).toEqual([{ kind: "abilityOffer", current: "Radar Sweep", drawn: "Line Scan" }]);
    });
});

describe("NetworkHandler.resync / broadcast", () =>
{
    it("reports an error when the state can't be fetched", async () =>
    {
        const { net, fetchState, listener } = setup();
        fetchState.mockResolvedValueOnce({ ok: false, error: "NOT_SEATED" });
        await net.resync("ABC234");
        expect(listener.onError).toHaveBeenCalledWith("NOT_SEATED");
    });

    it("leaves broadcasting to the database trigger", () =>
    {
        const { net } = setup();
        expect(() => net.broadcast({ getId: () => "ABC234" } as never)).toThrow("database trigger");
    });
});
