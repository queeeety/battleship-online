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

    public accept(): void
    {
        if (this.status !== RematchStatus.REQUESTED) throw new Error("This rematch has already been answered");
        this.status = RematchStatus.ACCEPTED;
    }

    public decline(): void
    {
        if (this.status !== RematchStatus.REQUESTED) throw new Error("This rematch has already been answered");
        this.status = RematchStatus.DECLINED;
    }

    // one player asked and the other accepted
    public isMutual(): boolean { return this.status === RematchStatus.ACCEPTED; }

    public getRequestedBy(): Player { return this.requestedBy; }

    public getStatus(): RematchStatus { return this.status; }
}


