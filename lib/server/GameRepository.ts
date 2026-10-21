import type { Lobby, Game } from "../controllers";
import type { Shot } from "../entities/game";
import type { Player } from "../entities/players";
import type { Board, Coordinate } from "../entities/board";

type SupabaseClient = object;

/**
 * Loads and saves lobbies, games and fleets in the database.
 * Fleets live in game_secrets, which only the server can read.
 */
export class GameRepository
{
    private client: SupabaseClient;

    constructor()
    {
        this.client = {};
    }

    public loadLobby(code: string): Lobby | null { return null; }

    public saveLobby(l: Lobby): void {}

    public loadGame(code: string): Game { throw new Error("not implemented"); }

    public saveGame(g: Game): void {}

    public loadFleet(code: string, p: Player): Board { throw new Error("not implemented"); }

    public saveFleet(code: string, p: Player, b: Board): void {}

    public runShotTransaction(code: string, shooter: Player, target: Coordinate): Shot { throw new Error("not implemented"); }
}
