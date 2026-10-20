import { Board } from "./Board";
import { Coordinate } from "./Coordinate";
import { GameResult } from "./GameResult";
import { Ability } from "./Ability";
import { JoinError, Screen } from "./enums";

/**
 * Boundary class for the player.
 * Draws the screens and passes clicks on to the game.
 * In the real app this is the React component tree.
 */
export class UIManager
{
    private currentScreen: Screen;

    constructor()
    {
        this.currentScreen = Screen.HOME;
    }

    public showScreen(s: Screen): void { this.currentScreen = s; }

    public renderBoard(b: Board, isOwn: boolean): void {}

    public onCellClick(c: Coordinate): void {}

    public showError(e: JoinError): void {}

    public showCountdown(secondsLeft: number): void {}

    public showAbility(a: Ability): void {}

    // true = keep the current one, false = take the new one
    public promptKeepOrReplace(current: Ability, drawn: Ability): boolean { return true; }

    // green highlight, only on the scanning player's screen
    public showScanResult(cells: Coordinate[]): void {}

    public showResult(r: GameResult): void {}

    public getCurrentScreen(): Screen { return this.currentScreen; }
}
