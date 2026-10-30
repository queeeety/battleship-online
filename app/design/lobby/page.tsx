import type { Metadata } from "next";
import { LobbyScreen } from "../_screens/LobbyScreen";

export const metadata: Metadata = {
  title: "Lobby screen",
};

export default function LobbyScreenPage() {
  return <LobbyScreen />;
}
