import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabase } from "../supabase/server";

/**
 * Gives each player an anonymous session and checks they own the seat they claim.
 *
 * Uses the server client: the publishable key plus this request's session cookie,
 * so it always acts as the player who sent the request and RLS still applies.
 * A server client belongs to one request, so build a new SessionManager per request
 * with SessionManager.create().
 */
export class SessionManager
{
    private client: SupabaseClient;

    /** Takes the client directly so tests can pass in a fake one. App code uses create(). */
    constructor(client: SupabaseClient)
    {
        this.client = client;
    }

    /** Builds a SessionManager tied to the current request's cookies. */
    public static async create(): Promise<SessionManager>
    {
        return new SessionManager(await createServerSupabase());
    }

    /**
     * Signs a new player in with no account. Supabase creates an anonymous user,
     * and the server client writes the session cookie to the browser.
     * Returns the new user ID, which is the player's sessionId from now on.
     */
    public async signInAnonymously(): Promise<string>
    {
        const { data, error } = await this.client.auth.signInAnonymously();
        if (error || !data.user)
        {
            throw new Error(`Could not start a session: ${error?.message ?? "no user returned"}`);
        }
        return data.user.id;
    }

    /**
     * The sessionId of whoever sent this request, or null if they have no valid session yet.
     * getClaims() checks the cookie's signature, so an edited cookie is rejected
     * rather than letting someone pose as another player.
     */
    public async currentSessionId(): Promise<string | null>
    {
        const { data, error } = await this.client.auth.getClaims();
        if (error || !data)
        {
            return null;
        }
        return data.claims.sub ?? null;
    }

    /**
     * True if sessionId holds one of the two seats in the game with this code.
     * Reads through the server client, so RLS only returns the row to a seated player:
     * if no row comes back, the caller is not in this game.
     */
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
