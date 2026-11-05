"use client";

import dynamic from "next/dynamic";
import { StatusView } from "@/components/screens/StatusView";

// browser only: it reads localStorage and places the computer's fleet at random
export const LocalGameLoader = dynamic(() => import("./LocalGameClient").then((m) => m.LocalGameClient), {
  ssr: false,
  loading: () => <StatusView title="Loading…" />,
});
