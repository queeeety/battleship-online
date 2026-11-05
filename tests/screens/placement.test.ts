import { describe, it, expect } from "vitest";
import {
    FLEET_ORDER,
    clampStart,
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
        expect(shipAt(carrierAtB2, 4, 1)).toEqual({ type: "carrier", heading: "horizontal" });
        expect(shipAt(carrierAtB2, 4, 2)).toBeNull();
        expect(removeShip(carrierAtB2, "carrier")).toEqual([]);
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
