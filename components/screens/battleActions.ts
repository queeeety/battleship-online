import type { BattleResult } from "@/lib/server/actions/battle";
import type { AbilityRequest } from "@/lib/server/RequestValidator";

type Square = { row: number; col: number };

/** A battle's moves: the server actions online, the local Game against the computer. */
export interface BattleActions {
  fireShot: (target: Square) => Promise<BattleResult<unknown>>;
  useAbility: (request: AbilityRequest, target?: Square) => Promise<BattleResult<unknown>>;
  chooseAbility: (keep: boolean) => Promise<BattleResult<unknown>>;
  forfeit: () => Promise<BattleResult<unknown>>;
  /** Fires the timed-out player's random shot; true once it was fired. */
  claimTimeout: () => Promise<boolean>;
}
