import { Game } from "./Game";
import { HumanPlayer } from "./HumanPlayer";
import { Coordinate } from "./Coordinate";

// stands in for Supabase's RealtimeChannel until the client library is added
type Channel = object;

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

    // joins the private channel "game:<code>"
    public subscribe(code: string): void {}

    public broadcast(g: Game): void {}

    public trackPresence(p: HumanPlayer): void {}

    public onDisconnect(p: HumanPlayer): void {}

    // scan results go to the scanning player only
    public sendPrivate(p: HumanPlayer, cells: Coordinate[]): void {}

    public resync(code: string): void {}
}
