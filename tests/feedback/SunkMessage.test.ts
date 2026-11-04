import { describe, it, expect } from "vitest";
import { sunkText } from "../../components/feedback/SunkMessage";

describe("sunkText", () =>
{
    it("words your sink with the opponent's name", () =>
    {
        expect(sunkText("Cruiser", "you", "Teddy")).toBe("You sank Teddy’s Cruiser.");
    });

    it("words their sink as in Figma \"Battle - 33\"", () =>
    {
        expect(sunkText("Destroyer", "opponent", "Teddy")).toBe("Teddy sank your Destroyer.");
    });
});
