import { GameType } from "./enums";
import { Lobby } from "./Lobby";
import { HumanPlayer } from "./HumanPlayer";
import { Board } from "./Board";
import { Coordinate } from "./Coordinate";
import { Shot } from "./Shot";
import { Ability } from "./Ability";
import { RematchRequest } from "./RematchRequest";
import { Game } from "./Game";

/**
 * The single authority for lobbies and games.
 * Every client action goes through here so nobody can change the game directly.
 * Stateless - the lobby and game get loaded from the database on each request.
 */
export class Server
{
    constructor() {}

    // blank name gets a random one like "Player482", otherwise 1-16 chars
    public createLobby(name: string, type: GameType): Lobby { throw new Error("not implemented"); }

    public joinLobby(code: string, name: string): HumanPlayer { throw new Error("not implemented"); }

    public placeShips(code: string, layout: Board): boolean { return false; }

    public fireShot(code: string, target: Coordinate): Shot { throw new Error("not implemented"); }

    public useAbility(code: string, a: Ability, target: Coordinate): void {}

    public forfeit(code: string): void {}

    public requestRematch(code: string, accept: boolean): RematchRequest { throw new Error("not implemented"); }

    public getMyState(code: string): Game { throw new Error("not implemented"); }

    public restoreSeat(sessionId: string): HumanPlayer { throw new Error("not implemented"); }

    // added for submission 2
    // client asks when its countdown hits 0, server checks if time is actually up
    public claimTimeout(code: string): void {}

    // keep the held ability or swap it for the new one
    public chooseAbility(code: string, keep: boolean): void {}
}
