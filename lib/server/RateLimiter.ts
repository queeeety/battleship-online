import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

type LimitCheck = Pick<Ratelimit, "limit">;

/**
 * Caps how often a player can create or join lobbies, so codes can't be guessed in bulk.
 * Default 10 per minute per action per player. Fails open if Upstash is missing or down.
 */
export class RateLimiter
{
    private maxRequests: number;
    private windowMs: number;
    private ratelimit: LimitCheck | null;

    // tests pass a fake; null turns limiting off
    constructor(maxRequests: number = 10, windowMs: number = 60_000, ratelimit?: LimitCheck | null)
    {
        this.maxRequests = maxRequests;
        this.windowMs = windowMs;
        this.ratelimit = ratelimit === undefined ? RateLimiter.fromEnv(maxRequests, windowMs) : ratelimit;
    }

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
            console.error("Rate limit check failed, allowing the request", e);
            return true;
        }
    }

    public getMaxRequests(): number { return this.maxRequests; }

    public getWindowMs(): number { return this.windowMs; }

    private static fromEnv(maxRequests: number, windowMs: number): LimitCheck | null
    {
        const url = process.env.UPSTASH_REDIS_REST_URL;
        const token = process.env.UPSTASH_REDIS_REST_TOKEN;
        if (!url || !token) return null;

        return new Ratelimit({
            redis: new Redis({ url, token }),
            limiter: Ratelimit.slidingWindow(maxRequests, `${windowMs} ms`),
            prefix: "mybattleship",
            timeout: 1000
        });
    }
}
