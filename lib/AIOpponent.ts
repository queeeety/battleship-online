import { Player } from "./Player";
import { Coordinate } from "./Coordinate";
import { Difficulty } from "./enums";

/**
 * The computer player. Only runs in the browser.
 * Easy fires at random, Normal hunts on a checkerboard then
 * targets the squares next to a hit until the ship sinks.
 */
export class AIOpponent extends Player
{
    private difficulty: Difficulty;
    private huntQueue: Coordinate[];

    constructor(difficulty: Difficulty)
    {
        super("Computer");
        this.difficulty = difficulty;
        this.huntQueue = [];
    }

    public chooseTarget(): Coordinate { throw new Error("not implemented"); }

    // same rules as a human, the AI just decides for itself
    public shouldUseAbility(): boolean { return false; }

    // checkerboard search, only squares where row + col is even
    private hunt(): Coordinate { throw new Error("not implemented"); }

    // after a hit, work through the neighbours until the ship sinks
    private target(): Coordinate { throw new Error("not implemented"); }

    public getDifficulty(): Difficulty { return this.difficulty; }
}
