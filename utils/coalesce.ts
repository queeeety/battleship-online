/**
 * One call at a time; calls made meanwhile share a single follow-up run. Next sends server
 * actions one at a time, so a burst of getMyState refetches would otherwise delay the next shot.
 */
export function coalesce<A extends unknown[], R>(fn: (...args: A) => Promise<R>): (...args: A) => Promise<R> {
    let running: Promise<R> | null = null;
    let queued: Promise<R> | null = null;
    let nextArgs: A;

    function start(): Promise<R> {
        const run = fn(...nextArgs);
        running = run;
        const done = () => {
            if (running === run) running = null;
        };
        run.then(done, done);
        return run;
    }

    return (...args: A) => {
        nextArgs = args;
        if (queued) return queued;
        if (!running) return start();
        // the catch hop lets `done` clear `running` first
        queued = running.catch(() => undefined).then(() => {
            queued = null;
            return start();
        });
        return queued;
    };
}
