//  Keeps each player's anonymous Supabase session alive. Sessions expire after an hour, so this
//  checks the session cookie on the way in and, if it has expired, swaps it for a fresh one.

import { createServerClient } from "@supabase/ssr";

import { NextResponse, type NextRequest } from "next/server";
// NextRequest is the incoming request (with its cookies).
// NextResponse is what we send back, and we can attach cookies to it.

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(

    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,

    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        // Read the key card from the incoming request.

        setAll: (toSet, headers) => {
          toSet.forEach(({ name, value }) => request.cookies.set(name, value));

          response = NextResponse.next({ request });

          toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
          // Put the fresh cookies on the response, so the player's browser saves them.

          Object.entries(headers).forEach(([k, v]) => response.headers.set(k, v));
          // Add Supabase's "don't cache this" headers. Without them, a cache could save this response and hand one player's key card to another player.
        },
      },
    }
  );

  await supabase.auth.getClaims();
  // The actual check: reads the key card and, if it has expired, refreshes it (which triggers setAll above). 

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|ico)$).*)"],
  // Which requests the doorman checks: everything except images, icons and Next.js's own built files, which don't need a key card.
};