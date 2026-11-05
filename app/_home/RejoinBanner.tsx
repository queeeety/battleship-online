import Link from "next/link";
import { connection } from "next/server";
import { Banner } from "@/components/ui";
import { restoreSeat } from "@/lib/server/actions/lobby";

// reads the session cookie, so it renders inside a Suspense boundary
export async function RejoinBanner() {
  // request time only: setting up the Supabase clients reads the clock before the cookies
  await connection();
  const seat = await restoreSeat();
  if (!seat?.ok) return null;

  return (
    <Banner
      tone="info"
      icon="player"
      action={
        <Link href={`/game/${seat.code}`} className="mb-btn mb-btn-secondary mb-btn-sm">
          Rejoin
        </Link>
      }
    >
      You still have a seat in game <span className="font-mono">{seat.code}</span>.
    </Banner>
  );
}
