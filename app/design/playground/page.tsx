import type { Metadata } from "next";
import { PlaygroundLoader } from "./PlaygroundLoader";

export const metadata: Metadata = {
  title: "Abilities playground",
};

export default function PlaygroundPage() {
  return <PlaygroundLoader />;
}
