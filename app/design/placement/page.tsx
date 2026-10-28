import type { Metadata } from "next";
import { ShowcaseStrip } from "../_screens/chrome";
import { PlacementScreen } from "../_screens/PlacementScreen";

export const metadata: Metadata = {
  title: "Placement screen",
};

export default function PlacementScreenPage() {
  return (
    <>
      <ShowcaseStrip name="Placement screen" />
      <PlacementScreen />
    </>
  );
}
