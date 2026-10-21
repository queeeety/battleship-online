import type { Game } from "../entities/game";
import type { HumanPlayer } from "../entities/players";
import type { Coordinate } from "../entities/board";
import type { Ability } from "../abilities";

type Channel = object;

export type PrivatePayload =
    | { kind: "scanResult"; cells: Coordinate[] }
    | { kind: "keepOrReplace"; current: Ability; drawn: Ability };

/**
 * Boundary class for the network.
 * Owns the realtime channel for one game, pushes state and tracks who is connected.
 * Broadcasts are just hints - on reconnect we refetch from the server.
 */
export class NetworkHandler
{
    private channel: Channel | null;

    constructor()
    {
        this.channel = null;
    }

    public subscribe(code: string): void {}

    public broadcast(g: Game): void {}

    public trackPresence(p: HumanPlayer): void {}

    public onDisconnect(p: HumanPlayer): void {}

    public sendPrivate(p: HumanPlayer, payload: PrivatePayload): void {}

    public resync(code: string): void {}
}

