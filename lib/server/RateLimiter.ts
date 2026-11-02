import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

/** The one call RateLimiter needs from Upstash's Ratelimit, so tests can swap in a fake. */
type LimitCheck = Pick<Ratelimit, "limit">;

/**
 * Caps how often a player can create or join lobbies, so codes can't be guessed in bulk.
 *
 * Counts each player's requests per action in Upstash Redis over a sliding window
 * (by default 10 per minute). Each action has its own count, so creating lobbies
 * doesn't use up the allowance for joining one.
 *
 * Fails open: with no Upstash keys (e.g. a teammate without them in .env.local)
 * or if Upstash is unreachable, every request is allowed rather than blocking the game.
 */
export class RateLimiter
{
    private maxRequests: number;
    private windowMs: number;
    private ratelimit: LimitCheck | null;

    /**
     * App code uses the defaults. Tests pass in a fake `ratelimit`; passing null turns limiting off.
     */
    constructor(maxRequests: number = 10, windowMs: number = 60_000, ratelimit?: LimitCheck | null)
    {
        this.maxRequests = maxRequests;
        this.windowMs = windowMs;
        this.ratelimit = ratelimit === undefined ? RateLimiter.fromEnv(maxRequests, windowMs) : ratelimit;
    }

    /**
     * True if this session may make another `action` request right now.
     * Counted per session and action, e.g. "createLobby:fc81045c-…".
     */
    public async allow(sessionId: string, action: string): Promise<boolean>
    {
        if (this.ratelimit === null) return true;
        try
        {
            const { success } = await this.ratelimit.limit(`${action}:${sessionId}`);
            return success;
        }
        catch (e)
        {
            // Upstash down or misconfigured: let the player through and leave a trace in the logs
            console.error("Rate limit check failed, allowing the request", e);
            return true;
        }
    }

    public getMaxRequests(): number { return this.maxRequests; }

    public getWindowMs(): number { return this.windowMs; }

    /** Builds the Upstash limiter from .env.local, or null if the keys aren't there. */
    private static fromEnv(maxRequests: number, windowMs: number): LimitCheck | null
    {
        const url = process.env.UPSTASH_REDIS_REST_URL;
        const token = process.env.UPSTASH_REDIS_REST_TOKEN;
        if (!url || !token) return null;

        return new Ratelimit({
            redis: new Redis({ url, token }),
            limiter: Ratelimit.slidingWindow(maxRequests, `${windowMs} ms`),
            prefix: "mybattleship",
            // give up after a second and let the request through, so a slow Upstash never stalls a join
            timeout: 1000
        });
    }
}
