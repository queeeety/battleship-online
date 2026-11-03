import { z } from "zod";
import { Board, Coordinate } from "../entities/board";
import { BOARD_SIZE, LOBBY_CODE_CHARS, LOBBY_CODE_LENGTH, PLAYER_NAME_MAX_LENGTH } from "../config";
import { GameType } from "../enums";

/** Thrown on invalid input. `field` lets Server map it to the right JoinError. */
export class InvalidRequestError extends Error
{
    public readonly field: "code" | "name" | "coordinate" | "layout" | "gameType" | "answer" | "ability";

    constructor(field: "code" | "name" | "coordinate" | "layout" | "gameType" | "answer" | "ability", message: string)
    {
        super(message);
        this.name = "InvalidRequestError";
        this.field = field;
    }
}

/** Which ability to use, plus what Line Scan and Reroute need to know. */
export type AbilityRequest =
    | { name: "Double Shot" }
    | { name: "Radar Sweep" }
    | { name: "Line Scan"; line: "row" | "column" }
    | { name: "Reroute"; ship: string; orientation: "horizontal" | "vertical" };

/**
 * Checks the shape of every request before the game rules see it.
 * Each parse method returns a clean value or throws InvalidRequestError.
 */
export class RequestValidator
{
    private codeSchema: z.ZodType<string>;
    private nameSchema: z.ZodType<string | null>;
    private coordinateSchema: z.ZodType<{ row: number; col: number }>;
    private layoutSchema: z.ZodType<{ ships: { name: string; row: number; col: number; orientation: "horizontal" | "vertical" }[] }>;
    private gameTypeSchema: z.ZodType<GameType>;
    private abilitySchema: z.ZodType<AbilityRequest>;

    constructor()
    {
        const square = z.int().min(0).max(BOARD_SIZE - 1);

        this.codeSchema = z.string().trim().toUpperCase()
            .regex(new RegExp(`^[${LOBBY_CODE_CHARS}]{${LOBBY_CODE_LENGTH}}$`));

        // blank or missing → null (random name)
        this.nameSchema = z.string().trim().max(PLAYER_NAME_MAX_LENGTH).nullish()
            .transform(name => name ? name : null);

        this.coordinateSchema = z.object({ row: square, col: square });

        // shape only; Board checks placement
        this.layoutSchema = z.object({
            ships: z.array(z.object({
                name: z.string(),
                row: square,
                col: square,
                orientation: z.enum(["horizontal", "vertical"])
            })).max(10)
        });

        this.gameTypeSchema = z.enum(GameType);

        this.abilitySchema = z.discriminatedUnion("name", [
            z.object({ name: z.literal("Double Shot") }),
            z.object({ name: z.literal("Radar Sweep") }),
            z.object({ name: z.literal("Line Scan"), line: z.enum(["row", "column"]) }),
            z.object({ name: z.literal("Reroute"), ship: z.string().max(20), orientation: z.enum(["horizontal", "vertical"]) })
        ]);
    }

    public parseCode(raw: unknown): string
    {
        const result = this.codeSchema.safeParse(raw);
        if (!result.success) throw new InvalidRequestError("code", "Lobby codes are 6 letters and numbers");
        return result.data;
    }

    public parseName(raw: unknown): string | null
    {
        const result = this.nameSchema.safeParse(raw);
        if (!result.success) throw new InvalidRequestError("name", `Names can be at most ${PLAYER_NAME_MAX_LENGTH} characters`);
        return result.data;
    }

    /** Shape only; Server checks the caller really holds it. */
    public parseAbilityRequest(raw: unknown): AbilityRequest
    {
        const result = this.abilitySchema.safeParse(raw);
        if (!result.success) throw new InvalidRequestError("ability", "Unknown ability or missing details");
        return result.data;
    }

    /** A yes/no answer, e.g. accepting a rematch. */
    public parseAnswer(raw: unknown): boolean
    {
        if (typeof raw !== "boolean") throw new InvalidRequestError("answer", "Expected true or false");
        return raw;
    }

    public parseGameType(raw: unknown): GameType
    {
        const result = this.gameTypeSchema.safeParse(raw);
        if (!result.success) throw new InvalidRequestError("gameType", "Unknown game type");
        return result.data;
    }

    public parseCoordinate(raw: unknown): Coordinate
    {
        const result = this.coordinateSchema.safeParse(raw);
        if (!result.success) throw new InvalidRequestError("coordinate", "That square isn't on the board");
        return Coordinate.fromRowCol(result.data.row, result.data.col);
    }

    /** Zod checks the shape, then Board applies the same placement rules as the UI. */
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
