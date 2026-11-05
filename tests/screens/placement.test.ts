import { describe, it, expect } from "vitest";
import {
    FLEET_ORDER,
    clampStart,
    haloKeys,
    turnAbout,
    isComplete,
    placeShip,
    placementError,
    placementErrorText,
    randomLayout,
    readyLabel,
    removeShip,
    shipAt,
    squareKeys,
    toShipPlacements,
    type Layout
} from "../../components/screens/placement";
import { RequestValidator } from "../../lib/server/RequestValidator";
import { PlacementError } from "../../lib/enums";

const carrierAtB2: Layout = [{ name: "Carrier", row: 1, col: 1, orientation: "horizontal" }];

describe("placement", () =>
{
    it("lists the fleet carrier first", () =>
    {
        expect(FLEET_ORDER).toEqual(["carrier", "battleship", "cruiser", "submarine", "destroyer"]);
    });

    it("places a ship where it fits", () =>
    {
        expect(placementError([], "carrier", 1, 1, "horizontal")).toBeNull();
        expect(placeShip([], "carrier", 1, 1, "horizontal")).toEqual(carrierAtB2);
    });

    it("refuses a ship that hangs off the board", () =>
    {
        expect(placementError([], "carrier", 7, 0, "horizontal")).toBe(PlacementError.OUT_OF_BOUNDS);
        expect(placementError([], "destroyer", 0, 9, "vertical")).toBe(PlacementError.OUT_OF_BOUNDS);
    });

    it("refuses an overlap, and a ship touching another, corners included", () =>
    {
        expect(placementError(carrierAtB2, "cruiser", 3, 0, "vertical")).toBe(PlacementError.OVERLAPS_SHIP);
        expect(placementError(carrierAtB2, "cruiser", 1, 2, "horizontal")).toBe(PlacementError.TOO_CLOSE);
        expect(placementError(carrierAtB2, "cruiser", 6, 2, "horizontal")).toBe(PlacementError.TOO_CLOSE);
        expect(placementError(carrierAtB2, "cruiser", 1, 3, "horizontal")).toBeNull();
    });

    it("refuses a second copy of a placed ship", () =>
    {
        expect(placementError(carrierAtB2, "carrier", 0, 5, "horizontal")).toBe(PlacementError.ALREADY_PLACED);
    });

    it("pulls a start square back so the ship stays on the board", () =>
    {
        expect(clampStart("carrier", 8, 4, "horizontal")).toEqual({ x: 5, y: 4 });
        expect(clampStart("carrier", 8, 9, "vertical")).toEqual({ x: 8, y: 5 });
        expect(clampStart("destroyer", 3, 3, "horizontal")).toEqual({ x: 3, y: 3 });
    });

    it("finds the ship on a square and takes it off again", () =>
    {
        expect(shipAt(carrierAtB2, 4, 1)).toEqual({ type: "carrier", heading: "horizontal", x: 1, y: 1 });
        expect(shipAt(carrierAtB2, 4, 2)).toBeNull();
        expect(removeShip(carrierAtB2, "carrier")).toEqual([]);
    });

    it("turns a ship about the square clicked", () =>
    {
        // a cruiser on C6-E6, turned about its middle square D6, stands on D5-D7
        expect(turnAbout("cruiser", 2, 5, "horizontal", 1)).toEqual({ x: 3, y: 4, heading: "vertical" });
        // and back again
        expect(turnAbout("cruiser", 3, 4, "vertical", 1)).toEqual({ x: 2, y: 5, heading: "horizontal" });
        // about its first square, it swings down from there
        expect(turnAbout("cruiser", 2, 5, "horizontal", 0)).toEqual({ x: 2, y: 5, heading: "vertical" });
    });

    it("keeps a turned ship on the board", () =>
    {
        // a carrier on B1-F1 turned about D1 would stick out above the top row, so it starts at D1
        expect(turnAbout("carrier", 1, 0, "horizontal", 2)).toEqual({ x: 3, y: 0, heading: "vertical" });
    });

    it("rings a ship with the free squares it needs, corners included, clipped to the board", () =>
    {
        // a destroyer in the top-left corner: C1, A2, B2 and C2 around it
        const corner = haloKeys([], "destroyer", 0, 0, "horizontal");
        expect(corner.clear.sort()).toEqual(["A2", "B2", "C1", "C2"]);
        expect(corner.blocked).toEqual([]);
        // a cruiser in open water has 12 squares around it
        expect(haloKeys([], "cruiser", 4, 4, "horizontal").clear).toHaveLength(12);
    });

    it("marks the halo squares that another ship is on", () =>
    {
        // the carrier sits on B2-F2; a cruiser on B3-D3 has it all along one side
        const { clear, blocked } = haloKeys(carrierAtB2, "cruiser", 1, 2, "horizontal");
        expect(blocked.sort()).toEqual(["B2", "C2", "D2", "E2"]);
        expect(clear).toContain("A2");
        // corner to corner with the carrier's last square
        expect(haloKeys(carrierAtB2, "cruiser", 6, 2, "horizontal").blocked).toEqual(["F2"]);
    });

    it("keys the covered squares and skips any off the board", () =>
    {
        expect(squareKeys("cruiser", 2, 4, "horizontal")).toEqual(["C5", "D5", "E5"]);
        expect(squareKeys("cruiser", 9, 8, "vertical")).toEqual(["J9", "J10"]);
    });

    it("randomises a complete fleet the server accepts", () =>
    {
        const layout = randomLayout();
        expect(isComplete(layout)).toBe(true);
        expect(isComplete(layout.slice(1))).toBe(false);
        const board = new RequestValidator().parseLayout({ ships: layout });
        expect(board.isFleetComplete()).toBe(true);
    });

    it("hands the Board component columns as x and rows as y", () =>
    {
        expect(toShipPlacements(carrierAtB2)).toEqual([{ type: "carrier", x: 1, y: 1, orientation: "horizontal" }]);
    });

    it("words each error for the player", () =>
    {
        expect(placementErrorText(PlacementError.OVERLAPS_SHIP, "cruiser")).toBe("Cruiser overlaps another ship.");
        expect(placementErrorText(PlacementError.TOO_CLOSE, "cruiser")).toBe("Cruiser needs a free square between it and other ships.");
    });

    it("counts the ships left on the Ready button", () =>
    {
        expect(readyLabel(2)).toBe("Ready · 2 ships left");
        expect(readyLabel(1)).toBe("Ready · 1 ship left");
        expect(readyLabel(0)).toBe("Ready");
    });
});
