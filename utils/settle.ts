export type ServerErrorResult = { ok: false; error: "SERVER_ERROR" };

// a request that throws (offline, server restarting) becomes the action's own SERVER_ERROR result
export async function settle<T>(call: () => Promise<T>): Promise<T | ServerErrorResult> {
    try {
        return await call();
    } catch (e) {
        console.error("Server action failed", e);
        return { ok: false, error: "SERVER_ERROR" };
    }
}
