import type { GameType } from "../enums";
import type { Lobby } from "./Lobby";
import type { HumanPlayer } from "../entities/players";
import type { Board, Coordinate } from "../entities/board";
import type { Game, Shot, RematchRequest } from "../entities/game";
import type { Ability } from "../abilities";

/**
 * The single authority for lobbies and games.
 * Every client action goes through here so nobody can change the game directly.
 * Stateless - the lobby and game get loaded from the database on each request.
 */
export class Server
{
    constructor() {}

    public createLobby(name: string, type: GameType): Lobby { throw new Error("not implemented"); }

    public joinLobby(code: string, name: string): HumanPlayer { throw new Error("not implemented"); }

    public placeShips(code: string, layout: Board): boolean { return false; }

    public fireShot(code: string, target: Coordinate): Shot { throw new Error("not implemented"); }

    public useAbility(code: string, a: Ability, target: Coordinate): void {}

    public forfeit(code: string): void {}

    public requestRematch(code: string, accept: boolean): RematchRequest { throw new Error("not implemented"); }

    public getMyState(code: string): Game { throw new Error("not implemented"); }

    public restoreSeat(sessionId: string): HumanPlayer { throw new Error("not implemented"); }

    public claimTimeout(code: string): void {}

    public chooseAbility(code: string, keep: boolean): void {}

    private assignRandomName(): string { return ""; }
}
