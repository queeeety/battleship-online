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

    public allow(sessionId: string, action: string): boolean { return false; }
}

