import type { Metadata } from "next";
import { PlacementScreen } from "../_screens/PlacementScreen";

export const metadata: Metadata = {
  title: "Placement screen",
};

export default function PlacementScreenPage() {
  return <PlacementScreen />;
}
