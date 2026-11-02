import type { SupabaseClient } from "@supabase/supabase-js";
import { Lobby } from "../controllers/Lobby";
import type { Game } from "../controllers";
import type { Shot } from "../entities/game";
import type { Player } from "../entities/players";
import { HumanPlayer } from "../entities/players";
import type { Board, Coordinate } from "../entities/board";
import { GameState, GameType, LobbyStatus } from "../enums";
import { createAdminSupabase } from "../supabase/admin";

/**
 * The columns of a games row that the lobby uses.
 * Matches supabase/migrations/20261027120000_init_schema.sql.
 */
interface LobbyRow
{
    code: string;
    lobby_status: string;
    game_type: string;
    game_state: string | null;
    player1_id: string;
    player1_name: string;
    player2_id: string | null;
    player2_name: string | null;
    ready_p1: boolean;
    ready_p2: boolean;
    disconnected_at_p1: string | null;
    disconnected_at_p2: string | null;
    created_at: string;
}

/**
 * Loads and saves lobbies, games and fleets in the database.
 * Fleets live in game_secrets, which only the server can read.
 *
 * Uses the admin client (secret key, bypasses RLS), so it must only ever run on the server,
 * and only after Server has checked the caller is allowed to make the change.
 */
export class GameRepository
{
    // the enums are numbers in TypeScript but lowercase text in the database
    private static readonly LOBBY_STATUS = new Map<LobbyStatus, string>([
        [LobbyStatus.WAITING, "waiting"],
        [LobbyStatus.IN_PROGRESS, "in_progress"],
        [LobbyStatus.FINISHED, "finished"],
        [LobbyStatus.ABANDONED, "abandoned"]
    ]);

    private static readonly GAME_TYPE = new Map<GameType, string>([
        [GameType.BEGINNER, "beginner"],
        [GameType.ORIGINAL, "original"],
        [GameType.QUICK_FIRE, "quickfire"]
    ]);

    private static readonly GAME_STATE = new Map<GameState, string>([
        [GameState.PLACEMENT, "placement"],
        [GameState.IN_PROGRESS, "in_progress"],
        [GameState.FINISHED, "finished"]
    ]);

    private client: SupabaseClient;

    /** App code uses the default admin client; tests pass in a fake one. */
    constructor(client: SupabaseClient = createAdminSupabase())
    {
        this.client = client;
    }

    /**
     * Rebuilds the lobby with this code, or null if no row has it.
     * Players come back in seat order with their ready flags and disconnect times.
     * Game progress (shots, turn, abilities) is loaded separately by loadGame.
     */
    public async loadLobby(code: string): Promise<Lobby | null>
    {
        const { data, error } = await this.client
            .from("games")
            .select("code, lobby_status, game_type, game_state, player1_id, player1_name, player2_id, player2_name, ready_p1, ready_p2, disconnected_at_p1, disconnected_at_p2, created_at")
            .eq("code", code)
            .maybeSingle<LobbyRow>();

        if (error) throw new Error(`Could not load lobby ${code}: ${error.message}`);
        if (!data) return null;

        const players = [GameRepository.seatedPlayer(data.player1_name, data.player1_id, data.ready_p1, data.disconnected_at_p1)];
        if (data.player2_id && data.player2_name)
        {
            players.push(GameRepository.seatedPlayer(data.player2_name, data.player2_id, data.ready_p2, data.disconnected_at_p2));
        }

        return Lobby.restore(
            data.code,
            GameRepository.fromText(GameRepository.GAME_TYPE, data.game_type),
            GameRepository.fromText(GameRepository.LOBBY_STATUS, data.lobby_status),
            new Date(data.created_at),
            players);
    }

    /**
     * Writes the lobby's own columns: code, status, game type and both seats.
     * Creates the row if it's new, otherwise updates it. Columns the lobby doesn't own
     * (shots, turn, abilities) are left as they are.
     */
    public async saveLobby(l: Lobby): Promise<void>
    {
        const [host, guest] = l.getPlayers();
        if (!host) throw new Error("A lobby can't be saved without a host");

        const row = {
            code: l.getCode(),
            lobby_status: GameRepository.LOBBY_STATUS.get(l.getStatus()),
            game_type: GameRepository.GAME_TYPE.get(l.getGameType()),
            // the schema keeps game_state empty until the guest joins
            game_state: l.getStatus() === LobbyStatus.WAITING ? null : GameRepository.GAME_STATE.get(l.getGame().getState()),
            player1_id: host.getSessionId(),
            player1_name: host.getName(),
            player2_id: guest?.getSessionId() ?? null,
            player2_name: guest?.getName() ?? null,
            created_at: l.getCreatedAt().toISOString()
        };

        const { error } = await this.client.from("games").upsert(row, { onConflict: "code" });
        if (error) throw new Error(`Could not save lobby ${l.getCode()}: ${error.message}`);
    }

    /**
     * The code of the lobby this session is seated in and still playing (waiting or in progress),
     * or null if there isn't one. Used by restoreSeat after a refresh.
     */
    public async findActiveLobbyCode(sessionId: string): Promise<string | null>
    {
        const { data, error } = await this.client
            .from("games")
            .select("code")
            .or(`player1_id.eq.${sessionId},player2_id.eq.${sessionId}`)
            .in("lobby_status", ["waiting", "in_progress"])
            .order("updated_at", { ascending: false })
            .limit(1)
            .maybeSingle<{ code: string }>();

        if (error) throw new Error(`Could not look up the lobby for this session: ${error.message}`);
        return data?.code ?? null;
    }

    public loadGame(code: string): Game { throw new Error("not implemented"); }

    public saveGame(g: Game): void {}

    public loadFleet(code: string, p: Player): Board { throw new Error("not implemented"); }

    public saveFleet(code: string, p: Player, b: Board): void {}

    public runShotTransaction(code: string, shooter: Player, target: Coordinate): Shot { throw new Error("not implemented"); }

    /** Rebuilds one seated player. Their id is their sessionId, so it stays the same across requests. */
    private static seatedPlayer(name: string, sessionId: string, ready: boolean, disconnectedAt: string | null): HumanPlayer
    {
        const p = new HumanPlayer(name, sessionId);
        p.restoreState(sessionId, ready, null, null);
        if (disconnectedAt) p.disconnect(new Date(disconnectedAt));
        return p;
    }

    /** Looks up the enum value for a database string, e.g. "in_progress" → LobbyStatus.IN_PROGRESS. */
    private static fromText<E>(map: Map<E, string>, text: string): E
    {
        for (const [value, name] of map)
        {
            if (name === text) return value;
        }
        throw new Error(`Unexpected value "${text}" in the database`);
    }
}
