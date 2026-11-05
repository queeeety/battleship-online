import type { Metadata } from "next";
import { LocalGameLoader } from "./LocalGameLoader";

export const metadata: Metadata = {
  title: "Play the computer",
};

export default function PlayPage() {
  return <LocalGameLoader />;
}
