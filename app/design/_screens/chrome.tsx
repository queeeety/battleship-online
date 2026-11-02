"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { Toast } from "@/components/ui/Toast";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Logo } from "@/components/ui/Logo";

/** Panel skin shared by the HUD pieces, for plain panels on a screen. */
export const PANEL = "grid content-start gap-(--space-3) rounded-md border border-line bg-surface-100 p-(--space-4)";

/** A screen: top bar, then main; one column that never grows wider than the window. */
export const SCREEN = "grid flex-1 grid-cols-[minmax(0,1fr)] grid-rows-[auto_1fr]";

// the strip above a sample screen; not part of the screen itself
export function ShowcaseStrip({ name, children }: { name: string; children?: ReactNode }) {
  return (
    // one line at every width; on phones only the back arrow, the sample switches and the theme button stay
    <div className="flex items-center gap-(--space-3) border-b border-line bg-surface-100 px-(--space-4) py-(--space-2)">
      <Link href="/design" className="mb-label flex flex-none items-center gap-(--space-1) hover:text-ink">
        <Icon name="arrow-left" size={16} />
        <span className="max-[599px]:sr-only">Design system</span>
      </Link>
      <span className="mb-label min-w-0 flex-1 truncate">
        <span className="max-[599px]:hidden">{name} · sample data</span>
      </span>
      {children && (
        <div className="flex min-w-0 items-center gap-(--space-1) overflow-x-auto [scrollbar-width:none]">{children}</div>
      )}
      <ThemeToggle compact />
    </div>
  );
}

// switches a sample screen between its states; lives in the showcase strip
export function SampleStates<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex flex-none items-center gap-(--space-1)" role="group" aria-label={label}>
      {options.map((o) => (
        <Button
          key={o.value}
          size="sm"
          variant={o.value === value ? "secondary" : "ghost"}
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </Button>
      ))}
    </div>
  );
}

// copies text and confirms with a toast at the bottom centre, which goes away after about 3 seconds
export function useCopyToast() {
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(id);
  }, [toast]);

  async function copy(text: string, done: string) {
    try {
      await navigator.clipboard.writeText(text);
      setToast(done);
    } catch {
      setToast("Couldn't copy. Select it and copy it by hand.");
    }
  }

  const toastNode = toast && (
    <div className="pointer-events-none fixed inset-x-0 bottom-(--space-5) z-(--z-toast) flex justify-center px-(--space-4)">
      <div className="pointer-events-auto">
        <Toast icon="copy" onClose={() => setToast(null)}>
          {toast}
        </Toast>
      </div>
    </div>
  );

  return { copy, toastNode };
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
