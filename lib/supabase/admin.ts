import { createClient } from "@supabase/supabase-js";

export function createAdminSupabase() {
// Called by GameRepository whenever it reads or writes the database.

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,

    process.env.SUPABASE_SECRET_KEY!,
    // The secret key, which skips RLS entirely.

    { auth: { persistSession: false, autoRefreshToken: false } }
    // Turns off session handling. The admin client isn't a logged-in player, so there's no session to save or refresh.
  );
}