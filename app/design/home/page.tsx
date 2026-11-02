import type { Metadata } from "next";
import { ShowcaseStrip } from "../_screens/chrome";
import { HomeScreen } from "../_screens/HomeScreen";

export const metadata: Metadata = {
  title: "Home screen",
};

export default function HomeScreenPage() {
  return (
    <>
      <ShowcaseStrip name="Home screen" />
      <HomeScreen />
    </>
  );
}
