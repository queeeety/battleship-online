import { Player } from "./Player";
import type { Coordinate } from "../board";
import { DISCONNECT_GRACE_PERIOD_MS } from "../../config";

/**
 * A real person playing through the browser.
 * Keeps the session id so they can get their seat back after a refresh.
 */
export class HumanPlayer extends Player
{
    private static readonly GRACE_PERIOD_MS: number = DISCONNECT_GRACE_PERIOD_MS;

    private sessionId: string;
    private connected: boolean;
    private disconnectedAt: Date | null;

    constructor(name: string, sessionId: string)
    {
        super(name);
        this.sessionId = sessionId;
        this.connected = true;
        this.disconnectedAt = null;
    }

    /** A person picks their own square by clicking, so this is never asked of a human. */
    public chooseTarget(): Coordinate
    {
        throw new Error("A human player's target comes from their click, not from chooseTarget()");
    }

    /**
     * Marks the player as gone and starts the 60-second forfeit clock.
     * `at` defaults to now; GameRepository passes the saved time when it rebuilds the player.
     */
    public disconnect(at: Date = new Date()): void
    {
        this.connected = false;
        this.disconnectedAt = at;
    }

    /** Back before the grace period ran out: the forfeit clock stops. */
    public reconnect(): void
    {
        this.connected = true;
        this.disconnectedAt = null;
    }

    /** True once a disconnected player has been gone longer than the grace period. */
    public hasExceededGracePeriod(now: Date = new Date()): boolean
    {
        if (this.connected || this.disconnectedAt === null) return false;
        return now.getTime() - this.disconnectedAt.getTime() > HumanPlayer.GRACE_PERIOD_MS;
    }

    public getDisconnectedAt(): Date | null { return this.disconnectedAt; }

    public getSessionId(): string { return this.sessionId; }

    public isConnected(): boolean { return this.connected; }
}

