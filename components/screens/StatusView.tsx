import Link from "next/link";
import type { ReactNode } from "react";
import { SCREEN, ScreenBar } from "./chrome";

export interface StatusViewProps {
  title: string;
  detail?: ReactNode;
  /** Shows a "Back to home" button. */
  home?: boolean;
  /** Extra content under the text, e.g. an error card. */
  children?: ReactNode;
}

export function StatusView({ title, detail, home, children }: StatusViewProps) {
  return (
    <div className={SCREEN}>
      <ScreenBar homeHref="/" />
      <main className="grid w-full max-w-[880px] content-start gap-(--space-4) px-(--space-4) pt-(--space-6) pb-(--space-6) min-[900px]:px-(--space-6)">
        <div className="grid max-w-md gap-(--space-2)" role="status">
          <h1 className="text-title">{title}</h1>
          {detail && <p className="text-ink-muted">{detail}</p>}
        </div>
        {children}
        {home && (
          <div>
            <Link href="/" className="mb-btn mb-btn-secondary mb-btn-md">
              Back to home
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
