import { createServerClient } from "@supabase/ssr";

import { cookies } from "next/headers";
// This is how the server sees the player's key card.

export async function createServerSupabase() {

  const cookieStore = await cookies();
  // Gets this request's cookies.

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
      // On the server, the client can't reach the cookies by itself, so we hand it two functions: one to read them, one to write them.

        getAll: () => cookieStore.getAll(),

        setAll: (toSet) => {

          try {
            toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
            // For each cookie Supabase wants saved, store it on the response so the player's browser keeps it. This is the key card being handed over.
          } catch {
          }
        },
      },
    }
  );
}