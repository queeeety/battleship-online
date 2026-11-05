import { Suspense } from "react";
import { HomeClient } from "./_home/HomeClient";
import { RejoinBanner } from "./_home/RejoinBanner";

export default function Home() {
  return (
    <HomeClient
      rejoin={
        <Suspense fallback={null}>
          <RejoinBanner />
        </Suspense>
      }
    />
  );
}
