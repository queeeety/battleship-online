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

    // e.g. "Victory - 34 shots, 50% accuracy, 5 ships sunk"
    public summary(): string
    {
        return (this.didWin ? "Victory" : "Defeat") + " - " + this.shotsFired + " shots, "
            + Math.round(this.accuracy) + "% accuracy, " + this.shipsSunk + " ships sunk";
    }

    public getDidWin(): boolean { return this.didWin; }

    public getShotsFired(): number { return this.shotsFired; }

    public getAccuracy(): number { return this.accuracy; }

    public getShipsSunk(): number { return this.shipsSunk; }
}
