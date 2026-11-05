import { TURN_TIME_LIMIT_SECONDS } from "@/lib/config";
import { GameType } from "@/lib/enums";

export type GameTypeName = keyof typeof GameType;

const LABELS: Record<GameTypeName, string> = {
  BEGINNER: "Beginner",
  ORIGINAL: "Original",
  QUICK_FIRE: "Quick Fire",
};

const NAMES = Object.keys(LABELS) as GameTypeName[];

export const GAME_TYPE_OPTIONS = NAMES.map((name) => ({
  value: name,
  label: LABELS[name],
  meta: `${TURN_TIME_LIMIT_SECONDS[GameType[name]]} s turns`,
}));

/** "Original" */
export function gameTypeName(type: GameType): string {
  return LABELS[GameType[type] as GameTypeName];
}

/** "Original · 15 s turns" */
export function gameTypeLabel(type: GameType): string {
  return `${LABELS[GameType[type] as GameTypeName]} · ${TURN_TIME_LIMIT_SECONDS[type]} s turns`;
}
