import { cx } from "@/components/ui/cx";
import { Icon } from "@/components/ui/Icon";

export interface PlayerChipProps {
  name: string;
  you?: boolean;
  ai?: boolean;
  presence?: "online" | "away" | "offline";
  /** Omit to hide the Ready / Placing tag. */
  ready?: boolean;
  host?: boolean;
}

const PRESENCE_TEXT = { online: "Online", away: "Away", offline: "Disconnected" };

export function PlayerChip({ name, you, ai, presence = "online", ready, host }: PlayerChipProps) {
  return (
    <div className={cx("mb-player", `is-${presence}`)}>
      <span className="mb-player-icon">
        <Icon name={ai ? "ai" : "player"} size={20} />
      </span>
      <span className="mb-player-body">
        <span className="mb-player-name">
          {name}
          {you && <span className="mb-player-you"> (you)</span>}
        </span>
        <span className="mb-player-meta">
          <i className="mb-presence" aria-hidden />
          {ai ? "Computer" : PRESENCE_TEXT[presence]}
          {host && " · Host"}
        </span>
      </span>
      {ready != null && <span className={cx("mb-tag", ready && "is-on")}>{ready ? "Ready" : "Placing"}</span>}
    </div>
  );
}
