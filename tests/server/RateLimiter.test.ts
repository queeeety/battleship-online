import { describe, it, expect, vi, afterEach } from "vitest";
import { RateLimiter } from "../../lib/server/RateLimiter";

afterEach(() => vi.restoreAllMocks());

/** A fake Upstash limiter that allows the first `allowed` calls per key, then refuses. */
function fakeRatelimit(allowed: number)
{
    const counts = new Map<string, number>();
    return {
        limit: vi.fn(async (key: string) =>
        {
            const n = (counts.get(key) ?? 0) + 1;
            counts.set(key, n);
            return { success: n <= allowed, limit: allowed, remaining: Math.max(0, allowed - n), reset: 0, pending: Promise.resolve() };
        })
    };
}

describe("RateLimiter", () =>
{
    it("allows requests up to the limit, then refuses", async () =>
    {
        const limiter = new RateLimiter(3, 60_000, fakeRatelimit(3));
        const results = [];
        for (let i = 0; i < 4; i++) results.push(await limiter.allow("s1", "joinLobby"));
        expect(results).toEqual([true, true, true, false]);
    });

    it("counts each action separately", async () =>
    {
        const limiter = new RateLimiter(1, 60_000, fakeRatelimit(1));
        expect(await limiter.allow("s1", "createLobby")).toBe(true);
        expect(await limiter.allow("s1", "joinLobby")).toBe(true);
        expect(await limiter.allow("s1", "createLobby")).toBe(false);
    });

    it("counts each player separately", async () =>
    {
        const limiter = new RateLimiter(1, 60_000, fakeRatelimit(1));
        expect(await limiter.allow("s1", "joinLobby")).toBe(true);
        expect(await limiter.allow("s2", "joinLobby")).toBe(true);
    });

    it("keys counts by action and session", async () =>
    {
        const fake = fakeRatelimit(5);
        await new RateLimiter(5, 60_000, fake).allow("fc81045c", "createLobby");
        expect(fake.limit).toHaveBeenCalledWith("createLobby:fc81045c");
    });

    it("allows everything when limiting is off (no Upstash keys)", async () =>
    {
        const limiter = new RateLimiter(1, 60_000, null);
        for (let i = 0; i < 5; i++) expect(await limiter.allow("s1", "joinLobby")).toBe(true);
    });

    it("allows the request if Upstash fails", async () =>
    {
        vi.spyOn(console, "error").mockImplementation(() => {});
        const broken = { limit: vi.fn().mockRejectedValue(new Error("network down")) };
        expect(await new RateLimiter(1, 60_000, broken).allow("s1", "joinLobby")).toBe(true);
    });

    it("defaults to 10 requests a minute", () =>
    {
        const limiter = new RateLimiter(undefined, undefined, null);
        expect(limiter.getMaxRequests()).toBe(10);
        expect(limiter.getWindowMs()).toBe(60_000);
    });
});
