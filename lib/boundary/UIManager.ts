import type { Board, Coordinate } from "../entities/board";
import type { GameResult } from "../entities/game";
import type { Ability } from "../abilities";
import { Screen } from "../enums";
import type { JoinError } from "../enums";
import { BoardView } from "./BoardView";

/**
 * Boundary class for the player.
 * Draws the screens and passes clicks on to the game.
 * In the real app this is the React component tree.
 */
export class UIManager
{
    private currentScreen: Screen;
    private ownBoard: BoardView;
    private enemyBoard: BoardView;

    constructor()
    {
        this.currentScreen = Screen.HOME;
        this.ownBoard = new BoardView(true);
        this.enemyBoard = new BoardView(false);
    }

    public showScreen(s: Screen): void { this.currentScreen = s; }

    public renderBoard(b: Board, isOwn: boolean): void {}

    public onCellClick(c: Coordinate): void {}

    public showError(e: JoinError): void {}

    public showCountdown(secondsLeft: number): void {}

    public showAbility(a: Ability): void {}

    public promptKeepOrReplace(current: Ability, drawn: Ability): boolean { return false; }

    public showScanResult(cells: Coordinate[]): void {}

    public showResult(r: GameResult): void {}

    public getCurrentScreen(): Screen { return this.currentScreen; }
}
