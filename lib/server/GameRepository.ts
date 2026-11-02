import type { SupabaseClient } from "@supabase/supabase-js";
import { Lobby } from "../controllers/Lobby";
import { Game } from "../controllers/Game";
import type { GameSnapshot } from "../controllers/Game";
import type { Shot } from "../entities/game";
import type { Player } from "../entities/players";
import { HumanPlayer } from "../entities/players";
import type { Board, BoardSnapshot, Coordinate } from "../entities/board";
import { EndReason, GameState, GameType, LobbyStatus, ShotResult } from "../enums";
import { createAdminSupabase } from "../supabase/admin";

/** The games columns the lobby uses (see the init_schema migration). */
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

/** The games columns a running game uses. */
interface GameRow
{
    code: string;
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
    turn: number | null;
    turn_started_at: string | null;
    double_shot_active: boolean;
    winner: number | null;
    end_reason: string | null;
    finished_at: string | null;
    shots_p1: SavedShot[];
    shots_p2: SavedShot[];
    ability_p1: string | null;
    ability_p2: string | null;
    offered_ability_p1: string | null;
    offered_ability_p2: string | null;
    updated_at: string;
}

/** One entry in shots_p1 / shots_p2. */
interface SavedShot
{
    row: number;
    col: number;
    result: string;
    firedAt?: string;
    sunkShipName?: string | null;
}

/** A loaded game plus its version, which saveGame needs to detect a clash. */
export interface LoadedGame
{
    game: Game;
    version: string;
}

/** Someone else saved the game first, e.g. a double-click. The client should resync. */
export class StaleGameError extends Error
{
    constructor(code: string)
    {
        super(`Game ${code} changed before this move was saved`);
        this.name = "StaleGameError";
    }
}

/**
 * Loads and saves lobbies, games and fleets in the database.
 * Fleets live in game_secrets, which only the server can read.
 * Uses the admin client (bypasses RLS): server only, after Server's checks.
 */
export class GameRepository
{
    // enums are numbers in TS, text in the database
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

    private static readonly SHOT_RESULT = new Map<ShotResult, string>([
        [ShotResult.MISS, "miss"],
        [ShotResult.HIT, "hit"],
        [ShotResult.SUNK, "sunk"]
    ]);

    private static readonly END_REASON = new Map<EndReason, string>([
        [EndReason.FLEET_DESTROYED, "fleet_destroyed"],
        [EndReason.OPPONENT_FORFEIT, "opponent_forfeit"],
        [EndReason.OPPONENT_DISCONNECTED, "opponent_disconnected"]
    ]);

    // ability display names in the classes, keys in the database
    private static readonly ABILITY = new Map<string, string>([
        ["Double Shot", "double_shot"],
        ["Radar Sweep", "radar_sweep"],
        ["Line Scan", "line_scan"],
        ["Reroute", "reroute"]
    ]);

    private client: SupabaseClient;

    constructor(client: SupabaseClient = createAdminSupabase())
    {
        this.client = client;
    }

    /** Null if no row has this code. Game progress is loaded separately by loadGame. */
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

    /** Upserts only the lobby's columns; game columns are left alone. */
    public async saveLobby(l: Lobby): Promise<void>
    {
        const [host, guest] = l.getPlayers();
        if (!host) throw new Error("A lobby can't be saved without a host");

        const row = {
            code: l.getCode(),
            lobby_status: GameRepository.LOBBY_STATUS.get(l.getStatus()),
            game_type: GameRepository.GAME_TYPE.get(l.getGameType()),
            // null until the guest joins (schema rule)
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

    /** The waiting or in-progress lobby this session sits in, for restoreSeat. */
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

    /**
     * The game with this code and its version (for saveGame), or null if it hasn't started yet.
     * Rebuilt through Game.fromJSON, so the server runs exactly the same rules as AI mode.
     */
    public async loadGame(code: string): Promise<LoadedGame | null>
    {
        const { data: row, error } = await this.client
            .from("games")
            .select("code, game_type, game_state, player1_id, player1_name, player2_id, player2_name, ready_p1, ready_p2, disconnected_at_p1, disconnected_at_p2, turn, turn_started_at, double_shot_active, winner, end_reason, finished_at, shots_p1, shots_p2, ability_p1, ability_p2, offered_ability_p1, offered_ability_p2, updated_at")
            .eq("code", code)
            .maybeSingle<GameRow>();
        if (error) throw new Error(`Could not load game ${code}: ${error.message}`);
        if (!row || row.game_state === null || !row.player2_id || !row.player2_name) return null;

        const { data: secrets, error: secretsError } = await this.client
            .from("game_secrets")
            .select("board_p1, board_p2")
            .eq("code", code)
            .maybeSingle<{ board_p1: BoardSnapshot | null; board_p2: BoardSnapshot | null }>();
        if (secretsError) throw new Error(`Could not load fleets for ${code}: ${secretsError.message}`);

        const seats = [
            { id: row.player1_id, name: row.player1_name, ready: row.ready_p1, board: secrets?.board_p1, held: row.ability_p1, offered: row.offered_ability_p1 },
            { id: row.player2_id, name: row.player2_name, ready: row.ready_p2, board: secrets?.board_p2, held: row.ability_p2, offered: row.offered_ability_p2 }
        ];

        const shots = [...GameRepository.savedShots(row.shots_p1, 0), ...GameRepository.savedShots(row.shots_p2, 1)]
            .sort((a, b) => a.firedAt.localeCompare(b.firedAt));

        const game = Game.fromJSON({
            id: row.code,
            state: GameRepository.fromText(GameRepository.GAME_STATE, row.game_state),
            gameType: GameRepository.fromText(GameRepository.GAME_TYPE, row.game_type),
            players: seats.map(s => ({
                kind: "human" as const,
                id: s.id,
                sessionId: s.id,
                name: s.name,
                isReady: s.ready,
                board: s.board ?? { ships: [], shots: [] },
                heldAbility: GameRepository.abilityName(s.held),
                offeredAbility: GameRepository.abilityName(s.offered)
            })),
            shots,
            currentTurn: row.turn === null ? null : row.turn - 1,
            winner: row.winner === null ? null : row.winner - 1,
            turnStartedAt: row.turn_started_at,
            endReason: row.end_reason === null ? null : GameRepository.fromText(GameRepository.END_REASON, row.end_reason),
            finishedAt: row.finished_at,
            doubleShotActive: row.double_shot_active
        });

        // fromJSON doesn't know about disconnects, so put the forfeit clocks back
        [row.disconnected_at_p1, row.disconnected_at_p2].forEach((at, i) =>
        {
            if (at) (game.getPlayers()[i] as HumanPlayer).disconnect(new Date(at));
        });

        return { game, version: row.updated_at };
    }

    /**
     * Saves the whole game in one transaction via save_game().
     * Returns the new version, or null if someone saved first; then nothing is written.
     */
    public async saveGame(g: Game, version: string): Promise<string | null>
    {
        const saved = g.toJSON();
        const [p1, p2] = saved.players;
        const shotsBy = (seat: number) => saved.shots
            .filter(s => s.shooter === seat)
            .map(s => ({ row: s.row, col: s.col, result: GameRepository.SHOT_RESULT.get(s.result), firedAt: s.firedAt, sunkShipName: s.sunkShipName }));

        const { data, error } = await this.client.rpc("save_game", {
            p_code: g.getId(),
            p_expected_updated_at: version,
            p_game: {
                lobby_status: saved.state === GameState.FINISHED ? "finished" : "in_progress",
                game_state: GameRepository.GAME_STATE.get(saved.state),
                ready_p1: p1.isReady,
                ready_p2: p2.isReady,
                turn: saved.currentTurn === null ? null : saved.currentTurn + 1,
                turn_started_at: saved.turnStartedAt,
                double_shot_active: saved.doubleShotActive,
                winner: saved.winner === null ? null : saved.winner + 1,
                end_reason: saved.endReason === null ? null : GameRepository.END_REASON.get(saved.endReason),
                finished_at: saved.finishedAt,
                shots_p1: shotsBy(0),
                shots_p2: shotsBy(1),
                ability_p1: GameRepository.abilityKey(p1.heldAbility),
                ability_p2: GameRepository.abilityKey(p2.heldAbility),
                offered_ability_p1: GameRepository.abilityKey(p1.offeredAbility),
                offered_ability_p2: GameRepository.abilityKey(p2.offeredAbility)
            },
            p_board_p1: p1.board,
            p_board_p2: p2.board
        });
        if (error) throw new Error(`Could not save game ${g.getId()}: ${error.message}`);
        return (data as string | null) ?? null;
    }

    /** The fleet of player p in this game. */
    public async loadFleet(code: string, p: Player): Promise<Board>
    {
        const loaded = await this.loadGame(code);
        const own = loaded?.game.getPlayers().find(q => q.getId() === p.getId());
        if (!own) throw new Error(`${p.getName()} has no fleet in game ${code}`);
        return own.getBoard();
    }

    /** Places p's fleet and saves it. False if the game changed in the meantime. */
    public async saveFleet(code: string, p: Player, b: Board): Promise<boolean>
    {
        const loaded = await this.loadGame(code);
        const own = loaded?.game.getPlayers().find(q => q.getId() === p.getId());
        if (!loaded || !own) throw new Error(`${p.getName()} isn't in game ${code}`);
        own.placeFleet(b);
        return (await this.saveGame(loaded.game, loaded.version)) !== null;
    }

    /**
     * One shot as one transaction: load, apply the rules, save if nothing changed.
     * A second request against the same version (double-click, second tab) throws StaleGameError.
     */
    public async runShotTransaction(code: string, shooter: Player, target: Coordinate): Promise<Shot>
    {
        const loaded = await this.loadGame(code);
        if (!loaded) throw new Error(`Game ${code} hasn't started`);
        const own = loaded.game.getPlayers().find(q => q.getId() === shooter.getId());
        if (!own) throw new Error(`${shooter.getName()} isn't in game ${code}`);

        const shot = loaded.game.fireShot(own, target);
        if (await this.saveGame(loaded.game, loaded.version) === null) throw new StaleGameError(code);
        return shot;
    }

    // id = sessionId so it's stable across requests
    private static seatedPlayer(name: string, sessionId: string, ready: boolean, disconnectedAt: string | null): HumanPlayer
    {
        const p = new HumanPlayer(name, sessionId);
        p.restoreState(sessionId, ready, null, null);
        if (disconnectedAt) p.disconnect(new Date(disconnectedAt));
        return p;
    }

    private static savedShots(saved: SavedShot[], shooter: number): GameSnapshot["shots"]
    {
        return saved.map(s => ({
            row: s.row,
            col: s.col,
            result: GameRepository.fromText(GameRepository.SHOT_RESULT, s.result),
            shooter,
            firedAt: s.firedAt ?? new Date(0).toISOString(),
            sunkShipName: s.sunkShipName ?? null
        }));
    }

    private static abilityName(key: string | null): string | null
    {
        return key === null ? null : GameRepository.fromText(GameRepository.ABILITY, key);
    }

    private static abilityKey(name: string | null): string | null
    {
        if (name === null) return null;
        const key = GameRepository.ABILITY.get(name);
        if (!key) throw new Error(`Unknown ability "${name}"`);
        return key;
    }

    private static fromText<E>(map: Map<E, string>, text: string): E
    {
        for (const [value, name] of map)
        {
            if (name === text) return value;
        }
        throw new Error(`Unexpected value "${text}" in the database`);
    }
}
