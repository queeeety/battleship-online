import { createServerClient } from "@supabase/ssr";

import { cookies } from "next/headers";
// Next.js's way of reading and writing the cookies on the current request. This is how the server sees the player's key card.

export async function createServerSupabase() {
// Called fresh on every request, because each request belongs to a different player.

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
            // For each cookie Supabase wants saved, store it on the response
            // so the player's browser keeps it. This is the key card being handed over.

          } catch {
            // Writing cookies is only allowed in server actions and route handlers.
            // If this runs while a page is being drawn, writing fails. That's fine, because proxy.ts refreshes the cookie before the page loads anyway.
          }
        },
      },
    }
  );
}