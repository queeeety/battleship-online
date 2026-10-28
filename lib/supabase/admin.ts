import { createClient } from "@supabase/supabase-js";
// The plain Supabase client. No "ssr" version needed because this client never deals with cookies.

export function createAdminSupabase() {
// Called by GameRepository whenever it reads or writes the database.

  return createClient(
  // Builds the admin client and returns it.

    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    // Same project address.

    process.env.SUPABASE_SECRET_KEY!,
    // The secret key, which skips RLS entirely.
    // No NEXT_PUBLIC_ prefix, so Next.js never sends it to the browser:

    { auth: { persistSession: false, autoRefreshToken: false } }
    // Turns off session handling. The admin client isn't a logged-in player, so there's no session to save or refresh.
  );
}