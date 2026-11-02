import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * An in-memory stand-in for the Supabase admin client, covering the calls GameRepository makes:
 * games / game_secrets reads, the lobby upsert, and save_game() with its version check.
 * Test-only.
 */
export function fakeSupabase()
{
    const games = new Map<string, Record<string, unknown>>();
    const secrets = new Map<string, { board_p1: unknown; board_p2: unknown }>();
    let clock = 0;
    const nextVersion = () => `v${++clock}`;

    const table = (name: string) =>
    {
        const filters: [string, unknown][] = [];
        const query = {
            select: () => query,
            eq: (column: string, value: unknown) => { filters.push([column, value]); return query; },
            maybeSingle: async () =>
            {
                const code = filters.find(([c]) => c === "code")?.[1] as string;
                const found = name === "games" ? games.get(code) : secrets.get(code);
                return { data: found ? structuredClone(found) : null, error: null };
            },
            upsert: async (row: Record<string, unknown>) =>
            {
                const code = row.code as string;
                const blank = {
                    ready_p1: false, ready_p2: false, disconnected_at_p1: null, disconnected_at_p2: null,
                    turn: null, turn_started_at: null, double_shot_active: false, winner: null, end_reason: null, finished_at: null,
                    shots_p1: [], shots_p2: [], ability_p1: null, ability_p2: null, offered_ability_p1: null, offered_ability_p2: null
                };
                games.set(code, { ...blank, ...games.get(code), ...row, updated_at: nextVersion() });
                return { error: null };
            }
        };
        return query;
    };

    const client = {
        from: (name: string) => table(name),
        rpc: async (name: string, args: Record<string, unknown>) =>
        {
            if (name !== "save_game") throw new Error(`fake has no ${name}`);
            const row = games.get(args.p_code as string);
            if (!row || row.updated_at !== args.p_expected_updated_at) return { data: null, error: null };
            Object.assign(row, args.p_game, { updated_at: nextVersion() });
            secrets.set(args.p_code as string, { board_p1: args.p_board_p1, board_p2: args.p_board_p2 });
            return { data: row.updated_at, error: null };
        }
    } as unknown as SupabaseClient;

    return { client, games, secrets };
}
