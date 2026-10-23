import type { Board, Coordinate } from "../entities/board";

type ZodSchema = object;

/**
 * Checks the shape of every request before the game rules see it.
 */
export class RequestValidator
{
    private codeSchema: ZodSchema;
    private nameSchema: ZodSchema;
    private coordinateSchema: ZodSchema;
    private layoutSchema: ZodSchema;

    constructor()
    {
        this.codeSchema = {};
        this.nameSchema = {};
        this.coordinateSchema = {};
        this.layoutSchema = {};
    }

    public parseCode(raw: unknown): string { return ""; }

    public parseName(raw: unknown): string | null { return null; }

    public parseCoordinate(raw: unknown): Coordinate { throw new Error("not implemented"); }

    public parseLayout(raw: unknown): Board { throw new Error("not implemented"); }
}
