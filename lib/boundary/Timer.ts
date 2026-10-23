/**
 * Counts down a turn on the client.
 * The server still decides when time is really up.
 */
export class Timer
{
    private limitMs: number;
    private startedAt: Date | null;

    constructor()
    {
        this.limitMs = 0;
        this.startedAt = null;
    }

    public start(limitMs: number): void {}

    public stop(): void {}

    public secondsLeft(): number { return 0; }

    public hasExpired(): boolean { return false; }
}
