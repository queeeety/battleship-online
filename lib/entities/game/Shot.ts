import type { Coordinate } from "../board";
import { ShotResult } from "../../enums";
import type { Player } from "../players";

/**
 * Record of one shot - where it landed, what it hit, who fired it and when.
 * Game keeps a list of these as the history.
 */
export class Shot
{
    private coordinate: Coordinate;
    private result: ShotResult;
    private shooter: Player;
    private firedAt: Date;
    private sunkShipName: string | null;

    // firedAt is only passed when a saved game is loaded
    constructor(coordinate: Coordinate, result: ShotResult, shooter: Player, sunkShipName: string | null = null, firedAt: Date = new Date())
    {
        this.coordinate = coordinate;
        this.result = result;
        this.shooter = shooter;
        this.firedAt = firedAt;
        this.sunkShipName = sunkShipName;
    }

    public isHit(): boolean { return this.result === ShotResult.HIT || this.result === ShotResult.SUNK; }

    public getCoordinate(): Coordinate { return this.coordinate; }

    public getResult(): ShotResult { return this.result; }

    public getShooter(): Player { return this.shooter; }

    public getFiredAt(): Date { return this.firedAt; }

    public getSunkShipName(): string | null { return this.sunkShipName; }
}

