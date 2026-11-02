import { z } from "zod";
import { Board, Coordinate } from "../entities/board";
import { BOARD_SIZE, LOBBY_CODE_CHARS, LOBBY_CODE_LENGTH, PLAYER_NAME_MAX_LENGTH } from "../config";
import { GameType } from "../enums";

/**
 * Thrown when a request fails validation. `field` says which input was wrong,
 * so Server can turn it into the right error for the player (e.g. a bad name → JoinError.INVALID_NAME).
 */
export class InvalidRequestError extends Error
{
    public readonly field: "code" | "name" | "coordinate" | "layout" | "gameType";

    constructor(field: "code" | "name" | "coordinate" | "layout" | "gameType", message: string)
    {
        super(message);
        this.name = "InvalidRequestError";
        this.field = field;
    }
}

/**
 * Checks the shape of every request before the game rules see it.
 * Anything from the browser is untrusted, so each parse method either returns
 * a clean value or throws an InvalidRequestError. It never passes bad data on.
 */
export class RequestValidator
{
    private codeSchema: z.ZodType<string>;
    private nameSchema: z.ZodType<string | null>;
    private coordinateSchema: z.ZodType<{ row: number; col: number }>;
    private layoutSchema: z.ZodType<{ ships: { name: string; row: number; col: number; orientation: "horizontal" | "vertical" }[] }>;
    private gameTypeSchema: z.ZodType<GameType>;

    constructor()
    {
        const square = z.int().min(0).max(BOARD_SIZE - 1);

        // trimmed and upper-cased first, so " 4f7k2m " still works when typed by hand
        this.codeSchema = z.string().trim().toUpperCase()
            .regex(new RegExp(`^[${LOBBY_CODE_CHARS}]{${LOBBY_CODE_LENGTH}}$`));

        // missing or blank → null, meaning "give this player a random name"
        this.nameSchema = z.string().trim().max(PLAYER_NAME_MAX_LENGTH).nullish()
            .transform(name => name ? name : null);

        // the same {row, col} shape the database stores, zero-based
        this.coordinateSchema = z.object({ row: square, col: square });

        // the ships half of a BoardSnapshot; whether they actually fit is Board's job
        this.layoutSchema = z.object({
            ships: z.array(z.object({
                name: z.string(),
                row: square,
                col: square,
                orientation: z.enum(["horizontal", "vertical"])
            })).max(10)
        });

        // one of the GameType enum values: beginner, original or quick fire
        this.gameTypeSchema = z.enum(GameType);
    }

    /** A 6-character lobby code, upper-cased, using only the unambiguous characters. */
    public parseCode(raw: unknown): string
    {
        const result = this.codeSchema.safeParse(raw);
        if (!result.success) throw new InvalidRequestError("code", "Lobby codes are 6 letters and numbers");
        return result.data;
    }

    /** A trimmed display name of 1 to 16 characters, or null if left blank. */
    public parseName(raw: unknown): string | null
    {
        const result = this.nameSchema.safeParse(raw);
        if (!result.success) throw new InvalidRequestError("name", `Names can be at most ${PLAYER_NAME_MAX_LENGTH} characters`);
        return result.data;
    }

    /** One of the three game types. */
    public parseGameType(raw: unknown): GameType
    {
        const result = this.gameTypeSchema.safeParse(raw);
        if (!result.success) throw new InvalidRequestError("gameType", "Unknown game type");
        return result.data;
    }

    /** A square on the board, sent as {row, col} from 0 to 9. */
    public parseCoordinate(raw: unknown): Coordinate
    {
        const result = this.coordinateSchema.safeParse(raw);
        if (!result.success) throw new InvalidRequestError("coordinate", "That square isn't on the board");
        return Coordinate.fromRowCol(result.data.row, result.data.col);
    }

    /**
     * A full fleet layout. Zod checks the shape, then Board checks the rules,
     * using the same placement code the placement screen uses: every ship once,
     * inside the grid, no overlaps.
     */
    public parseLayout(raw: unknown): Board
    {
        const result = this.layoutSchema.safeParse(raw);
        if (!result.success) throw new InvalidRequestError("layout", "That fleet layout is malformed");

        let board: Board;
        try
        {
            board = Board.fromSnapshot({ ships: result.data.ships, shots: [] });
        }
        catch (e)
        {
            throw new InvalidRequestError("layout", e instanceof Error ? e.message : "That fleet layout is illegal");
        }

        if (!board.isFleetComplete()) throw new InvalidRequestError("layout", "Every ship has to be placed");
        return board;
    }
}
