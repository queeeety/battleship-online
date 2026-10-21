import type { Board } from "../entities/board";
import type { GameResult } from "../entities/game";

/**
 * The end of game screen: win or loss, stats, the revealed layout and the rematch prompt.
 */
export class ResultScreen
{
    private result: GameResult;

    constructor(result: GameResult)
    {
        this.result = result;
    }

    public show(r: GameResult, revealed: Board): void {}

    public showRematchPrompt(fromName: string): void {}

    public onRematch(): void {}

    public onHome(): void {}
}
