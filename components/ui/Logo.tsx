import type { CSSProperties } from "react";

export interface LogoProps {
  /** Mark height in px. */
  size?: number;
  /** false keeps the name for screen readers only. */
  wordmark?: boolean;
}

export function Logo({ size = 28, wordmark = true }: LogoProps) {
  return (
    <span className="mb-logo" style={{ "--mb-logo-size": `${size}px` } as CSSProperties}>
      <svg
        className="mb-logo-mark"
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        aria-hidden
      >
        <circle cx="16" cy="16" r="12.5" />
        <path d="M16 1.5v4M16 26.5v4M1.5 16h4M26.5 16h4" />
        <path d="M16 16 24.5 7.5" />
        <circle cx="16" cy="16" r="1.6" className="f" />
        <circle cx="20.5" cy="19.5" r="2" className="f" />
      </svg>
      <span className={wordmark ? "mb-logo-word" : "mb-sr"}>Battleship Online</span>
    </span>
  );
}
