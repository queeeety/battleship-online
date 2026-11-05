import type { PlayerView } from "@/lib/controllers/Server";
import { GameState, LobbyStatus } from "@/lib/enums";

export type ScreenKey = "loading" | "join" | "gone" | "closed" | "lobby" | "placement" | "battle" | "result";

export interface ScreenInput {
  view: PlayerView | null;
  notSeated: boolean;
  /** Seated earlier on this page, so NOT_SEATED now means the game was removed. */
  wasSeated: boolean;
}

export function screenFor({ view, notSeated, wasSeated }: ScreenInput): ScreenKey {
  if (notSeated) return wasSeated ? "gone" : "join";
  if (!view) return "loading";

  // a declined rematch abandons the lobby, but the finished game stays on the result screen
  switch (view.gameState) {
    case GameState.PLACEMENT:
      return "placement";
    case GameState.IN_PROGRESS:
      return "battle";
    case GameState.FINISHED:
      return "result";
  }
  return view.lobbyStatus === LobbyStatus.WAITING ? "lobby" : "closed";
}
