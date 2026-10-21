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

    public chooseTarget(): Coordinate { throw new Error("not implemented"); }

    public disconnect(): void {}

    public reconnect(): void {}

    public hasExceededGracePeriod(): boolean { return false; }

    public getSessionId(): string { return this.sessionId; }

    public isConnected(): boolean { return this.connected; }
}

