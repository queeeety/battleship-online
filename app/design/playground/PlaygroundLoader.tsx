"use client";

import dynamic from "next/dynamic";

// browser only: it deals both fleets at random as it starts
export const PlaygroundLoader = dynamic(() => import("../_screens/PlaygroundScreen").then((m) => m.PlaygroundScreen), {
  ssr: false,
});
