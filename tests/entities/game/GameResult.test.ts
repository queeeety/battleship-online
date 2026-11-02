import { describe, it, expect } from "vitest";
import { GameResult } from "../../../lib/entities/game/GameResult";

describe("GameResult", () =>
{
    it("summary shows the outcome, shots, rounded accuracy and ships sunk", () =>
    {
        expect(new GameResult(true, 34, 0.5, 5).summary()).toBe("Victory - 34 shots, 50% accuracy, 5 ships sunk");
        expect(new GameResult(false, 3, 2 / 3, 1).summary()).toBe("Defeat - 3 shots, 67% accuracy, 1 ship sunk");
    });
});
