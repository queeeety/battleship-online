import Link from "next/link";
import type { ReactNode } from "react";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { Icon } from "@/components/ui/Icon";
import { Logo } from "@/components/ui/Logo";

/** Panel skin shared by the HUD pieces, for plain panels on a screen. */
export const PANEL = "grid content-start gap-(--space-3) rounded-md border border-line bg-surface-100 p-(--space-4)";

/** A screen: top bar, then main; one column that never grows wider than the window. */
export const SCREEN = "grid flex-1 grid-cols-[minmax(0,1fr)] grid-rows-[auto_1fr]";

// the strip above a sample screen; not part of the screen itself
export function ShowcaseStrip({ name }: { name: string }) {
  return (
    <div className="flex items-center gap-(--space-3) border-b border-line bg-surface-100 px-(--space-4) py-(--space-2)">
      <Link href="/design" className="mb-label flex items-center gap-(--space-1) hover:text-ink">
        <Icon name="arrow-left" size={16} />
        Design system
      </Link>
      <span className="mb-label min-w-0 flex-1 truncate">{name} · sample data</span>
      <ThemeToggle />
    </div>
  );
}

// the top bar of every game screen: the logo on the left, the screen's own items on the right
export function ScreenBar({ children }: { children?: ReactNode }) {
  return (
    <div className="flex items-center gap-(--space-4) border-b border-line bg-surface-000 px-(--space-4) py-(--space-3) min-[900px]:px-(--space-6)">
      <Logo size={24} />
      <span className="flex-1" />
      <div className="flex min-w-0 items-center gap-(--space-3)">{children}</div>
    </div>
  );
}
