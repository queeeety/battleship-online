import { Board } from "../board";
import type { Coordinate } from "../board";
import type { Ability } from "../../abilities";
import { RematchRequest } from "../game/RematchRequest";
import type { Shot } from "../game";

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

    public placeFleet(b: Board): void
    {
        this.board = b;
        this.isReady = false;
    }

    // ready only once the whole fleet is on the board
    public confirmPlacement(): boolean
    {
        this.isReady = this.board.isFleetComplete();
        return this.isReady;
    }

    public abstract chooseTarget(): Coordinate;

    // Game calls this after each of this player's shots, the AI uses it to learn
    public recordShot(s: Shot): void {}

    // a second draw waits as an offer, and a newer draw replaces an offer that's still pending
    public receiveAbility(drawn: Ability): void
    {
        if (this.heldAbility === null) this.heldAbility = drawn;
        else this.offeredAbility = drawn;
    }

    public resolveOffer(keep: boolean): void
    {
        if (this.offeredAbility === null) return;
        if (!keep) this.heldAbility = this.offeredAbility;
        this.offeredAbility = null;
    }

    public consumeAbility(): void { this.heldAbility = null; }

    public clearAbilities(): void
    {
        this.heldAbility = null;
        this.offeredAbility = null;
    }

    // only for loading a saved game, everything else changes state through the methods above
    public restoreState(id: string, isReady: boolean, held: Ability | null, offered: Ability | null): void
    {
        this.id = id;
        this.isReady = isReady;
        this.heldAbility = held;
        this.offeredAbility = offered;
    }

    public hasLost(): boolean { return this.board.allShipsSunk(); }

    public requestRematch(): RematchRequest { return new RematchRequest(this); }

    public getId(): string { return this.id; }

    public getName(): string { return this.name; }

    public getIsReady(): boolean { return this.isReady; }

    public getBoard(): Board { return this.board; }

    public getHeldAbility(): Ability | null { return this.heldAbility; }

    public getOfferedAbility(): Ability | null { return this.offeredAbility; }
}
