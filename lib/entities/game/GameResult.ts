/**
 * The end of game stats for one player.
 * Not saved anywhere, Game works it out from the shot history.
 */
export class GameResult
{
    private didWin: boolean;
    private shotsFired: number;
    private accuracy: number;
    private shipsSunk: number;

    constructor(didWin: boolean, shotsFired: number, accuracy: number, shipsSunk: number)
    {
        this.didWin = didWin;
        this.shotsFired = shotsFired;
        this.accuracy = accuracy;
        this.shipsSunk = shipsSunk;
    }

    public summary(): string { return ""; }

    public getDidWin(): boolean { return this.didWin; }

    public getShotsFired(): number { return this.shotsFired; }

    public getAccuracy(): number { return this.accuracy; }

    public getShipsSunk(): number { return this.shipsSunk; }
}

