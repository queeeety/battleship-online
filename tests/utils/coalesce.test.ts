import { describe, it, expect } from "vitest";
import { coalesce } from "../../utils/coalesce";

// a call we finish by hand, so the test controls the order
function deferredCalls()
{
    const calls: { arg: string; resolve: (v: string) => void; reject: (e: Error) => void }[] = [];
    const fn = (arg: string) => new Promise<string>((resolve, reject) => calls.push({ arg, resolve, reject }));
    return { calls, fn };
}

const flush = () => new Promise(r => setTimeout(r, 0));

describe("coalesce", () =>
{
    it("runs a lone call straight away", async () =>
    {
        const { calls, fn } = deferredCalls();
        const call = coalesce(fn);
        const answer = call("a");
        expect(calls).toHaveLength(1);
        calls[0].resolve("A");
        expect(await answer).toBe("A");
    });

    it("folds a burst into one follow-up run with the latest arguments", async () =>
    {
        const { calls, fn } = deferredCalls();
        const call = coalesce(fn);
        const first = call("a");
        const second = call("b");
        const third = call("c");
        expect(calls).toHaveLength(1);

        calls[0].resolve("A");
        await flush();
        expect(calls.map(c => c.arg)).toEqual(["a", "c"]);
        calls[1].resolve("C");

        expect(await first).toBe("A");
        expect(await second).toBe("C");
        expect(await third).toBe("C");
    });

    it("still runs the follow-up when the first call fails", async () =>
    {
        const { calls, fn } = deferredCalls();
        const call = coalesce(fn);
        const first = call("a");
        const second = call("b");
        calls[0].reject(new Error("offline"));
        await expect(first).rejects.toThrow("offline");
        await flush();
        calls[1].resolve("B");
        expect(await second).toBe("B");
    });

    it("passes on a failing follow-up to everyone waiting for it", async () =>
    {
        const { calls, fn } = deferredCalls();
        const call = coalesce(fn);
        const first = call("a");
        const second = call("b");
        const third = call("c");
        calls[0].resolve("A");
        await first;
        await flush();
        calls[1].reject(new Error("offline"));
        await expect(second).rejects.toThrow("offline");
        await expect(third).rejects.toThrow("offline");
    });

    it("never runs two at once when a caller calls again as its answer arrives", async () =>
    {
        let running = 0;
        let most = 0;
        const finish: ((v: string) => void)[] = [];
        const call = coalesce((arg: string) =>
        {
            running++;
            most = Math.max(most, running);
            return new Promise<string>(resolve => finish.push(v => { running--; resolve(`${v}:${arg}`); }));
        });

        const first = call("a");
        void call("b");
        // the caller of "a" asks again as soon as its answer lands, before the follow-up has started
        const again = first.then(() => call("c"));
        finish[0]("A");
        await flush();
        expect(finish).toHaveLength(2);
        finish[1]("C");
        expect(await again).toBe("C:c");
        expect(most).toBe(1);
    });

    it("starts fresh once everything has finished", async () =>
    {
        const { calls, fn } = deferredCalls();
        const call = coalesce(fn);
        const first = call("a");
        calls[0].resolve("A");
        await first;
        await flush();
        const again = call("b");
        expect(calls).toHaveLength(2);
        calls[1].resolve("B");
        expect(await again).toBe("B");
    });
});
