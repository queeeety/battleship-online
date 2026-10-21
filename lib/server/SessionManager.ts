type SupabaseClient = object;

/**
 * Gives each player an anonymous session and checks they own the seat they claim.
 */
export class SessionManager
{
    private client: SupabaseClient;

    constructor()
    {
        this.client = {};
    }

    public signInAnonymously(): string { return ""; }

    public currentSessionId(): string { return ""; }

    public verifySeat(code: string, sessionId: string): boolean { return false; }
}
