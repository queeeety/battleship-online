import type { Metadata } from "next";
import { ShowcaseStrip } from "../_screens/chrome";
import { BattleScreen } from "../_screens/BattleScreen";

export const metadata: Metadata = {
  title: "Battle screen",
};

export default function BattleScreenPage() {
  return (
    <>
      <ShowcaseStrip name="Battle screen" />
      <BattleScreen />
    </>
  );
}
