/**
 * The end of game stats for one player.
 * Not saved anywhere, Game works it out from the shot history.
 * Accuracy is a fraction from 0 to 1.
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

    public summary(): string
    {
        const outcome = this.didWin ? "Victory" : "Defeat";
        const percent = Math.round(this.accuracy * 100);
        const ships = this.shipsSunk === 1 ? "ship" : "ships";
        return `${outcome} - ${this.shotsFired} shots, ${percent}% accuracy, ${this.shipsSunk} ${ships} sunk`;
    }

    public getDidWin(): boolean { return this.didWin; }

    public getShotsFired(): number { return this.shotsFired; }

    public getAccuracy(): number { return this.accuracy; }

    public getShipsSunk(): number { return this.shipsSunk; }
}

