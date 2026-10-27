import { describe, it, expect } from "vitest";
import { Player } from "../../../lib/entities/players/Player";
import { Board, Coordinate } from "../../../lib/entities/board";
import { Carrier } from "../../../lib/entities/ships";
import { RematchRequest } from "../../../lib/entities/game";
import { DoubleShot, LineScan, RadarSweep } from "../../../lib/abilities";
import { Orientation, RematchStatus } from "../../../lib/enums";
import { placeKnownFleet, knownFleetSquares } from "../../fixtures";

// Player is abstract, so the base class is tested through the smallest possible subclass
class TestPlayer extends Player
{
    public chooseTarget(): Coordinate { return new Coordinate(0, 0); }
}

describe("Player", () =>
{
    it("starts not ready, with an empty board, no abilities and its own id", () =>
    {
        const a = new TestPlayer("Aoife");
        const b = new TestPlayer("Cian");
        expect(a.getName()).toBe("Aoife");
        expect(a.getIsReady()).toBe(false);
        expect(a.getBoard().getShips()).toHaveLength(0);
        expect(a.getHeldAbility()).toBeNull();
        expect(a.getOfferedAbility()).toBeNull();
        expect(a.getId()).not.toBe(b.getId());
    });

    it("confirmPlacement is refused until the fleet is complete", () =>
    {
        const p = new TestPlayer("Aoife");
        p.getBoard().placeShip(new Carrier(), new Coordinate(0, 0), Orientation.HORIZONTAL);
        expect(p.confirmPlacement()).toBe(false);
        expect(p.getIsReady()).toBe(false);

        p.placeFleet(placeKnownFleet());
        expect(p.confirmPlacement()).toBe(true);
        expect(p.getIsReady()).toBe(true);
    });

    it("placeFleet swaps in the new board and clears the ready flag", () =>
    {
        const p = new TestPlayer("Aoife");
        p.placeFleet(placeKnownFleet());
        p.confirmPlacement();

        const next = new Board();
        p.placeFleet(next);
        expect(p.getBoard()).toBe(next);
        expect(p.getIsReady()).toBe(false);
    });

    it("has lost only once every ship on its board is sunk", () =>
    {
        const p = new TestPlayer("Aoife");
        const shooter = new TestPlayer("Cian");
        p.placeFleet(placeKnownFleet());
        const squares = knownFleetSquares();

        squares.slice(0, -1).forEach(c => p.getBoard().receiveShot(c, shooter));
        expect(p.hasLost()).toBe(false);
        p.getBoard().receiveShot(squares[squares.length - 1], shooter);
        expect(p.hasLost()).toBe(true);
    });

    it("a player with no ships placed hasn't lost", () =>
    {
        expect(new TestPlayer("Aoife").hasLost()).toBe(false);
    });

    it("the first ability received is held", () =>
    {
        const p = new TestPlayer("Aoife");
        const radar = new RadarSweep();
        p.receiveAbility(radar);
        expect(p.getHeldAbility()).toBe(radar);
        expect(p.getOfferedAbility()).toBeNull();
    });

    it("a second ability waits as an offer and the held one is kept until the player answers", () =>
    {
        const p = new TestPlayer("Aoife");
        const radar = new RadarSweep();
        const double = new DoubleShot();
        p.receiveAbility(radar);
        p.receiveAbility(double);
        expect(p.getHeldAbility()).toBe(radar);
        expect(p.getOfferedAbility()).toBe(double);
    });

    it("a newer draw replaces an offer that is still pending", () =>
    {
        const p = new TestPlayer("Aoife");
        const line = new LineScan();
        p.receiveAbility(new RadarSweep());
        p.receiveAbility(new DoubleShot());
        p.receiveAbility(line);
        expect(p.getOfferedAbility()).toBe(line);
    });

    it("resolveOffer(true) keeps the held ability and drops the offer", () =>
    {
        const p = new TestPlayer("Aoife");
        const radar = new RadarSweep();
        p.receiveAbility(radar);
        p.receiveAbility(new DoubleShot());
        p.resolveOffer(true);
        expect(p.getHeldAbility()).toBe(radar);
        expect(p.getOfferedAbility()).toBeNull();
    });

    it("resolveOffer(false) replaces the held ability with the offer", () =>
    {
        const p = new TestPlayer("Aoife");
        const double = new DoubleShot();
        p.receiveAbility(new RadarSweep());
        p.receiveAbility(double);
        p.resolveOffer(false);
        expect(p.getHeldAbility()).toBe(double);
        expect(p.getOfferedAbility()).toBeNull();
    });

    it("resolveOffer does nothing when there is no offer", () =>
    {
        const p = new TestPlayer("Aoife");
        const radar = new RadarSweep();
        p.receiveAbility(radar);
        p.resolveOffer(false);
        expect(p.getHeldAbility()).toBe(radar);
    });

    it("consumeAbility discards the held ability but leaves a pending offer", () =>
    {
        const p = new TestPlayer("Aoife");
        const double = new DoubleShot();
        p.receiveAbility(new RadarSweep());
        p.receiveAbility(double);
        p.consumeAbility();
        expect(p.getHeldAbility()).toBeNull();
        expect(p.getOfferedAbility()).toBe(double);
    });

    it("clearAbilities discards both the held ability and the offer", () =>
    {
        const p = new TestPlayer("Aoife");
        p.receiveAbility(new RadarSweep());
        p.receiveAbility(new DoubleShot());
        p.clearAbilities();
        expect(p.getHeldAbility()).toBeNull();
        expect(p.getOfferedAbility()).toBeNull();
    });

    it("requestRematch creates a request from this player", () =>
    {
        const p = new TestPlayer("Aoife");
        const request = p.requestRematch();
        expect(request).toBeInstanceOf(RematchRequest);
        expect(request.getRequestedBy()).toBe(p);
        expect(request.getStatus()).toBe(RematchStatus.REQUESTED);
    });

    it("recordShot does nothing by default", () =>
    {
        const p = new TestPlayer("Aoife");
        const shot = placeKnownFleet().receiveShot(new Coordinate(0, 0), p);
        expect(() => p.recordShot(shot)).not.toThrow();
    });
});
