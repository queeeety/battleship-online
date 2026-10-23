import type { Ability } from "./Ability";
import { DoubleShot } from "./DoubleShot";
import { RadarSweep } from "./RadarSweep";
import { LineScan } from "./LineScan";
import { Reroute } from "./Reroute";

/**
 * Every ability a player can draw when one of their ships is sunk.
 * To add an ability, make an Ability subclass and add it to this list.
 */
export const ABILITY_FACTORIES: ReadonlyArray<() => Ability> = [
    () => new DoubleShot(),
    () => new RadarSweep(),
    () => new LineScan(),
    () => new Reroute()
];

export function drawRandomAbility(exclude: string[] = []): Ability { throw new Error("not implemented"); }
