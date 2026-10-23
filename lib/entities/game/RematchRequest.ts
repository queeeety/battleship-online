import { RematchStatus } from "../../enums";
import type { Player } from "../players";

/**
 * A rematch offer after the game ends.
 * Both players have to agree, then the same lobby goes back to placement.
 */
export class RematchRequest
{
    private requestedBy: Player;
    private status: RematchStatus;
    private requestedAt: Date;

    constructor(requestedBy: Player)
    {
        this.requestedBy = requestedBy;
        this.status = RematchStatus.REQUESTED;
        this.requestedAt = new Date();
    }

    public accept(): void {}

    public decline(): void {}

    public isMutual(): boolean { return false; }

    public getRequestedBy(): Player { return this.requestedBy; }

    public getStatus(): RematchStatus { return this.status; }
}


