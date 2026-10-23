import { Board } from "../board";
import type { Coordinate } from "../board";
import type { Ability } from "../../abilities";
import type { RematchRequest } from "../game";

/**
 * A player in a match, either a person or the AI.
 * Each player owns one board and can hold one ability at a time.
 */
export abstract class Player
{
    private id: string;
    private name: string;
    private isReady: boolean;
    private heldAbility: Ability | null;
    private offeredAbility: Ability | null;
    protected board: Board;

    constructor(name: string)
    {
        this.id = crypto.randomUUID();
        this.name = name;
        this.isReady = false;
        this.heldAbility = null;
        this.offeredAbility = null;
        this.board = new Board();
    }

    public placeFleet(b: Board): void {}

    public confirmPlacement(): boolean { return false; }

    public abstract chooseTarget(): Coordinate;

    public receiveAbility(drawn: Ability): void {}

    public resolveOffer(keep: boolean): void {}

    public hasLost(): boolean { return false; }

    public requestRematch(): RematchRequest { throw new Error("not implemented"); }

    public getId(): string { return this.id; }

    public getName(): string { return this.name; }

    public getBoard(): Board { return this.board; }

    public getHeldAbility(): Ability | null { return this.heldAbility; }

    public getOfferedAbility(): Ability | null { return this.offeredAbility; }
}
