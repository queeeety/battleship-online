import type { BattleActions } from "@/components/screens/battleActions";
import { settle } from "@/utils/settle";
// the action isn't a hook, so it gets a name the hook rules won't mistake for one
import {
  chooseAbility,
  claimTimeout,
  fireShot,
  forfeit,
  useAbility as sendAbility,
} from "@/lib/server/actions/battle";

export function serverActions(code: string): BattleActions {
  return {
    fireShot: (target) => settle(() => fireShot(code, target)),
    useAbility: (request, target) => settle(() => sendAbility(code, request, target)),
    chooseAbility: (keep) => settle(() => chooseAbility(code, keep)),
    forfeit: () => settle(() => forfeit(code)),
    claimTimeout: () => settle(() => claimTimeout(code)).then((result) => result.ok && result.data),
  };
}
