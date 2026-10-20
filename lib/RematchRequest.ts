import { RematchStatus } from "./enums";
import { Player } from "./Player";

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

    public accept(): void { this.status = RematchStatus.ACCEPTED; }

    public decline(): void { this.status = RematchStatus.DECLINED; }

    public isMutual(): boolean { return this.status == RematchStatus.ACCEPTED; }

    public getRequestedBy(): Player { return this.requestedBy; }

    public getStatus(): RematchStatus { return this.status; }
}
