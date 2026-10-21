import { Player } from "./Player";
import type { Coordinate } from "../board";
import type { Shot } from "../game";
import type { Difficulty } from "../../enums";

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

    public chooseTarget(shotsFired: Shot[]): Coordinate { throw new Error("not implemented"); }

    public shouldUseAbility(): boolean { return false; }

    private hunt(): Coordinate { throw new Error("not implemented"); }

    private target(): Coordinate { throw new Error("not implemented"); }

    public getDifficulty(): Difficulty { return this.difficulty; }
}

