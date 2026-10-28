import { createBrowserClient } from "@supabase/ssr";
// Brings in Supabase's helper for making a client that runs in the browser.

export function createBrowserSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
    // The player-level key. Safe in the browser, because RLS limits it.
  );
}