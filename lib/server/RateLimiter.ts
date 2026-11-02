/**
 * Caps how often a player can create or join lobbies, so codes can't be guessed in bulk.
 */
export class RateLimiter
{
    private maxRequests: number;
    private windowMs: number;

    constructor()
    {
        this.maxRequests = 0;
        this.windowMs = 0;
    }

    /** Lets every request through for now; the Upstash limit replaces this in the next step. */
    public async allow(sessionId: string, action: string): Promise<boolean>
    {
        void sessionId;
        void action;
        return true;
    }
}

