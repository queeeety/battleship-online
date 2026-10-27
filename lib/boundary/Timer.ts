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

    public start(limitMs: number): void
    {
        this.limitMs = limitMs;
        this.startedAt = new Date();
    }

    public stop(): void
    {
        this.startedAt = null;
    }

    public secondsLeft(): number
    {
        if (this.startedAt === null) {
            return 0;
        }
        const elapsedMs = Date.now() - this.startedAt.getTime();
        return Math.max(0, (this.limitMs - elapsedMs) / 1000);
    }

    public hasExpired(): boolean
    {
        return this.startedAt !== null && this.secondsLeft() === 0;
    }
}
