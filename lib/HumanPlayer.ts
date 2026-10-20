import { Player } from "./Player";
import { Coordinate } from "./Coordinate";

/**
 * A real person playing through the browser.
 * Keeps the session id so they can get their seat back after a refresh.
 */
export class HumanPlayer extends Player
{
    private static readonly GRACE_PERIOD_MS = 60000; // 60s before a disconnect counts as a forfeit

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

    // the target is whatever cell they clicked on
    public chooseTarget(): Coordinate { throw new Error("not implemented"); }

    public disconnect(): void
    {
        this.connected = false;
        this.disconnectedAt = new Date();
    }

    public reconnect(): void
    {
        this.connected = true;
        this.disconnectedAt = null;
    }

    public hasExceededGracePeriod(): boolean
    {
        if (this.connected || this.disconnectedAt == null) return false;
        return Date.now() - this.disconnectedAt.getTime() > HumanPlayer.GRACE_PERIOD_MS;
    }

    public getSessionId(): string { return this.sessionId; }

    public isConnected(): boolean { return this.connected; }
}
