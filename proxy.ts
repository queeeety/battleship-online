//  Runs before every page request (Next.js 16 calls this "proxy"; older versions called it "middleware").
//  
//  Keeps each player's anonymous Supabase session alive. Sessions expire after an hour, so this
//  checks the session cookie on the way in and, if it has expired, swaps it for a fresh one.

import { createServerClient } from "@supabase/ssr";

import { NextResponse, type NextRequest } from "next/server";
// NextRequest is the incoming request (with its cookies).
// NextResponse is what we send back, and we can attach cookies to it.

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  // Start with "carry on as normal", passing the request through unchanged.
  // "let" because we may replace it below if the cookie gets refreshed.

  const supabase = createServerClient(
  // A server client just for the doorman's check.

    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,

    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        // Read the key card from the incoming request.

        setAll: (toSet, headers) => {
        // Supabase calls this if it refreshed an expired session.
        // toSet = the new cookies; headers = extra response headers it needs.

          toSet.forEach(({ name, value }) => request.cookies.set(name, value));
          // Update the request itself, so the page being loaded
          // sees the fresh card straight away.

          response = NextResponse.next({ request });
          // Rebuild the response from the updated request.

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
  // Keep this straight after creating the client, with no other code in between.

  return response;
  // Let the request carry on, now with a valid key card.
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|ico)$).*)"],
  // Which requests the doorman checks: everything except images, icons and Next.js's own built files, which don't need a key card.
};