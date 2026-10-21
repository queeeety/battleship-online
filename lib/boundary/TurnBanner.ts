import type { Game } from "../controllers";

/**
 * Shows whose turn it is, the countdown and the Forfeit button.
 */
export class TurnBanner
{
    private isMyTurn: boolean;
    private turnNumber: number;
    private secondsLeft: number;

    constructor()
    {
        this.isMyTurn = false;
        this.turnNumber = 0;
        this.secondsLeft = 0;
    }

    public update(g: Game): void {}

    public onForfeit(): void {}
}
