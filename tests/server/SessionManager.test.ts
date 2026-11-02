import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SessionManager } from "../../lib/server/SessionManager";

/**
 * A stand-in for the Supabase client with only the parts SessionManager calls.
 * `row` is what the games query returns: null means RLS hid the row (caller not seated).
 */
function fakeClient(opts: {
    signIn?: { data: { user: { id: string } | null }, error: { message: string } | null },
    claims?: { data: { claims: { sub?: string } } | null, error: { message: string } | null },
    row?: { player1_id: string, player2_id: string | null } | null
} = {}): SupabaseClient
{
    const query = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: opts.row ?? null, error: null })
    };
    return {
        auth: {
            signInAnonymously: vi.fn().mockResolvedValue(opts.signIn ?? { data: { user: null }, error: null }),
            getClaims: vi.fn().mockResolvedValue(opts.claims ?? { data: null, error: null })
        },
        from: vi.fn().mockReturnValue(query)
    } as unknown as SupabaseClient;
}

describe("SessionManager", () =>
{
    it("signInAnonymously returns the new user's ID as the sessionId", async () =>
    {
        const sessions = new SessionManager(fakeClient({ signIn: { data: { user: { id: "user-1" } }, error: null } }));
        expect(await sessions.signInAnonymously()).toBe("user-1");
    });

    it("signInAnonymously throws when Supabase refuses the sign-in", async () =>
    {
        const sessions = new SessionManager(fakeClient({ signIn: { data: { user: null }, error: { message: "disabled" } } }));
        await expect(sessions.signInAnonymously()).rejects.toThrow("disabled");
    });

    it("currentSessionId reads the user ID from a valid session", async () =>
    {
        const sessions = new SessionManager(fakeClient({ claims: { data: { claims: { sub: "user-1" } }, error: null } }));
        expect(await sessions.currentSessionId()).toBe("user-1");
    });

    it("currentSessionId is null when there is no session", async () =>
    {
        const sessions = new SessionManager(fakeClient());
        expect(await sessions.currentSessionId()).toBeNull();
    });

    it("currentSessionId is null when the session cookie fails verification", async () =>
    {
        const sessions = new SessionManager(fakeClient({ claims: { data: null, error: { message: "invalid JWT" } } }));
        expect(await sessions.currentSessionId()).toBeNull();
    });

    it("verifySeat accepts either seated player", async () =>
    {
        const sessions = new SessionManager(fakeClient({ row: { player1_id: "host", player2_id: "guest" } }));
        expect(await sessions.verifySeat("ABC234", "host")).toBe(true);
        expect(await sessions.verifySeat("ABC234", "guest")).toBe(true);
    });

    it("verifySeat rejects a session that holds neither seat", async () =>
    {
        const sessions = new SessionManager(fakeClient({ row: { player1_id: "host", player2_id: "guest" } }));
        expect(await sessions.verifySeat("ABC234", "stranger")).toBe(false);
    });

    it("verifySeat rejects when RLS hides the game from the caller", async () =>
    {
        const sessions = new SessionManager(fakeClient({ row: null }));
        expect(await sessions.verifySeat("ABC234", "host")).toBe(false);
    });
});
