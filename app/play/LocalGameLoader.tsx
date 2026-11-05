"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { StatusView } from "@/components/screens/StatusView";

// browser only: it reads localStorage and places the computer's fleet at random
const LocalGameClient = dynamic(() => import("./LocalGameClient").then((m) => m.LocalGameClient), {
  ssr: false,
  loading: () => <StatusView title="Loading…" />,
});

// Next keeps a page you leave alive; keyed like this, a fresh visit (Home's Play vs AI, a link)
// starts again at the setup screen, while Back and Forward return to the game as it was
export function LocalGameLoader() {
  const { bfcacheId } = useRouter();
  return <LocalGameClient key={bfcacheId} />;
}
