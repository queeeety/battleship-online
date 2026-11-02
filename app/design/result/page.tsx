import type { Metadata } from "next";
import { ResultScreen } from "../_screens/ResultScreen";

export const metadata: Metadata = {
  title: "Result screen",
};

export default function ResultScreenPage() {
  return <ResultScreen />;
}
