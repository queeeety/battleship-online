import type { Ability } from "../abilities";

/**
 * Shows the ability you hold, the keep-or-replace prompt and targeting mode.
 */
export class AbilityCard
{
    private ability: Ability | null;
    private armed: boolean;

    constructor()
    {
        this.ability = null;
        this.armed = false;
    }

    public show(a: Ability): void {}

    public showKeepOrReplace(current: Ability, drawn: Ability): void {}

    public arm(): void {}

    public cancel(): void {}
}
