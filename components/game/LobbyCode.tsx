import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";

export interface LobbyCodeProps {
  code: string;
  link?: string;
  waiting?: boolean;
  /** Confirm a copy with a Toast ("Lobby code copied."). */
  onCopyCode?: () => void;
  onCopyLink?: () => void;
}

export function LobbyCode({ code, link, waiting = true, onCopyCode, onCopyLink }: LobbyCodeProps) {
  const chars = code.split("");

  return (
    <div className="mb-lobbycode">
      <span className="mb-label">Lobby code</span>
      {/* one box per character so it can be read out; screen readers get it spaced */}
      <span className="mb-sr">{chars.join(" ")}</span>
      <div className="mb-lobbycode-read" aria-hidden>
        {chars.map((c, i) => (
          <span key={i}>{c}</span>
        ))}
      </div>
      {link && (
        <div className="mb-lobbycode-link">
          <Icon name="link" size={16} />
          <span>{link}</span>
        </div>
      )}
      <div className="mb-row">
        <Button size="sm" icon="copy" onClick={onCopyCode}>
          Copy code
        </Button>
        {link && (
          <Button size="sm" variant="ghost" icon="link" onClick={onCopyLink}>
            Copy link
          </Button>
        )}
      </div>
      {waiting && (
        <p className="mb-lobbycode-wait" role="status">
          <span className="mb-pulse" aria-hidden />
          Waiting for opponent
        </p>
      )}
    </div>
  );
}
