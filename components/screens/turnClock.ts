export interface ClockInput {
  total: number;
  turnStartedAt: string | null;
  now: number;
  /** While paused, when the clock stopped (the mover's disconnectedAt). */
  pausedAt?: string | null;
}

// clamped, since the client's clock can be ahead of or behind the server's
export function secondsLeft({ total, turnStartedAt, now, pausedAt }: ClockInput): number {
  if (!turnStartedAt) return total;
  const started = Date.parse(turnStartedAt);
  const until = pausedAt ? Math.max(started, Date.parse(pausedAt)) : now;
  const elapsed = Math.min(Math.max(until - started, 0), total * 1000);
  return Math.ceil((total * 1000 - elapsed) / 1000);
}
