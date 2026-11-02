import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabase } from "../supabase/server";

/**
 * Gives each player an anonymous session and checks they own the seat they claim.
 * Uses the server client, so it acts as the calling player. One per request: use create().
 */
export class SessionManager
{
    private client: SupabaseClient;

    // tests pass in a fake client
    constructor(client: SupabaseClient)
    {
        this.client = client;
    }

    public static async create(): Promise<SessionManager>
    {
        return new SessionManager(await createServerSupabase());
    }

    /** Creates an anonymous user and sets the session cookie. Returns the new sessionId. */
    public async signInAnonymously(): Promise<string>
    {
        const { data, error } = await this.client.auth.signInAnonymously();
        if (error || !data.user)
        {
            throw new Error(`Could not start a session: ${error?.message ?? "no user returned"}`);
        }
        return data.user.id;
    }

    /** The caller's sessionId, or null. getClaims() verifies the signature, so edited cookies fail. */
    public async currentSessionId(): Promise<string | null>
    {
        const { data, error } = await this.client.auth.getClaims();
        if (error || !data)
        {
            return null;
        }
        return data.claims.sub ?? null;
    }

    /** True if sessionId holds a seat in this game. RLS hides the row from anyone not seated. */
    public async verifySeat(code: string, sessionId: string): Promise<boolean>
    {
        const { data, error } = await this.client
            .from("games")
            .select("player1_id, player2_id")
            .eq("code", code)
            .maybeSingle();

        if (error || !data)
        {
            return false;
        }
        return data.player1_id === sessionId || data.player2_id === sessionId;
    }
}
