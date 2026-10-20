import { Board } from "./Board";
import { Ability } from "./Ability";
import { Coordinate } from "./Coordinate";
import { RematchRequest } from "./RematchRequest";

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
    private offeredAbility: Ability | null;  // new draw waiting on keep-or-replace
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

    // HumanPlayer waits for a click, AIOpponent works it out
    public abstract chooseTarget(): Coordinate;

    // if one is already held it goes into offeredAbility until they choose
    public receiveAbility(drawn: Ability): void {}

    // keep = true keeps the held one, false swaps in the offered one
    public resolveOffer(keep: boolean): void {}

    public hasLost(): boolean { return this.board.allShipsSunk(); }

    public requestRematch(): RematchRequest { throw new Error("not implemented"); }

    public getId(): string { return this.id; }

    public getName(): string { return this.name; }

    public getBoard(): Board { return this.board; }

    public getHeldAbility(): Ability | null { return this.heldAbility; }

    public getOfferedAbility(): Ability | null { return this.offeredAbility; }
}
