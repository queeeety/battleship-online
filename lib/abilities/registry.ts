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

// a fresh ability picked at random, skipping any whose name is in exclude
// (Game excludes "Reroute" when none of the player's ships could move)
export function drawRandomAbility(exclude: string[] = []): Ability
{
    const pool = ABILITY_FACTORIES.map(make => make()).filter(a => !exclude.includes(a.getName()));
    if (pool.length === 0) throw new Error("Every ability was excluded, there's nothing left to draw");
    return pool[Math.floor(Math.random() * pool.length)];
}

// a fresh ability from its name, as saved or sent by the server; null for an unknown name
export function createAbility(name: string): Ability | null
{
    for (const make of ABILITY_FACTORIES)
    {
        const ability = make();
        if (ability.getName() === name) return ability;
    }
    return null;
}
