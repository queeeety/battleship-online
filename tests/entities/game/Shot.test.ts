import { describe, it, expect, vi, afterEach } from "vitest";
import { Shot } from "../../../lib/entities/game/Shot";
import { Coordinate } from "../../../lib/entities/board";
import { HumanPlayer } from "../../../lib/entities/players";
import { ShotResult } from "../../../lib/enums";

const shooter = new HumanPlayer("Cian", "s1");

afterEach(() => vi.useRealTimers());

describe("Shot", () =>
{
    it("is a hit for HIT and SUNK, not for MISS", () =>
    {
        const at = new Coordinate(7, 7);
        expect(new Shot(at, ShotResult.HIT, shooter).isHit()).toBe(true);
        expect(new Shot(at, ShotResult.SUNK, shooter, "Destroyer").isHit()).toBe(true);
        expect(new Shot(at, ShotResult.MISS, shooter).isHit()).toBe(false);
    });

    it("records where it landed, the result and who fired it", () =>
    {
        const at = new Coordinate(7, 7);
        const shot = new Shot(at, ShotResult.MISS, shooter);
        expect(shot.getCoordinate()).toBe(at);
        expect(shot.getResult()).toBe(ShotResult.MISS);
        expect(shot.getShooter()).toBe(shooter);
    });

    it("stamps the time it was fired", () =>
    {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-01-01T12:00:00Z"));
        const shot = new Shot(new Coordinate(0, 0), ShotResult.MISS, shooter);
        expect(shot.getFiredAt().toISOString()).toBe("2026-01-01T12:00:00.000Z");
    });

    it("keeps a fire time passed in when a saved game is loaded", () =>
    {
        const firedAt = new Date("2026-01-01T09:30:00Z");
        expect(new Shot(new Coordinate(0, 0), ShotResult.MISS, shooter, null, firedAt).getFiredAt()).toBe(firedAt);
    });

    it("only names a ship when one was sunk", () =>
    {
        expect(new Shot(new Coordinate(0, 0), ShotResult.SUNK, shooter, "Carrier").getSunkShipName()).toBe("Carrier");
        expect(new Shot(new Coordinate(0, 0), ShotResult.HIT, shooter).getSunkShipName()).toBeNull();
    });
});
