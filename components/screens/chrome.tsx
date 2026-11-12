"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { Toast } from "@/components/ui/Toast";
import { Logo } from "@/components/ui/Logo";

// fades each screen in; keyed on the screen, so it replays only when the screen changes
export function ScreenFade({ screen, children }: { screen: string; children: ReactNode }) {
  return (
    <div key={screen} className="mb-screen-in flex flex-1 flex-col">
      {children}
    </div>
  );
}

/** Top bar, then main, in one column no wider than the window. */
export const SCREEN = "grid flex-1 grid-cols-[minmax(0,1fr)] grid-rows-[auto_1fr]";

export function useCopyToast() {
  // a fresh object per copy, so copying the same thing twice restarts the 3 seconds
  const [toast, setToast] = useState<{ text: string } | null>(null);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(id);
  }, [toast]);

  async function copy(text: string, done: string) {
    try {
      await navigator.clipboard.writeText(text);
      setToast({ text: done });
    } catch {
      setToast({ text: "Couldn't copy. Select it and copy it by hand." });
    }
  }

  const toastNode = toast && (
    <div className="pointer-events-none fixed inset-x-0 bottom-(--space-5) z-(--z-toast) flex justify-center px-(--space-4)">
      <div className="pointer-events-auto">
        <Toast icon="copy" onClose={() => setToast(null)}>
          {toast.text}
        </Toast>
      </div>
    </div>
  );

  return { copy, toastNode };
}

export function ScreenBar({ children, homeHref }: { children?: ReactNode; homeHref?: string }) {
  return (
    <div className="flex items-center gap-(--space-4) border-b border-line bg-surface-000 px-(--space-4) py-(--space-3) min-[900px]:px-(--space-6)">
      {homeHref ? (
        <Link href={homeHref} className="flex text-ink" aria-label="Battleship Online home">
          <Logo size={24} />
        </Link>
      ) : (
        <Logo size={24} />
      )}
      <span className="flex-1" />
      <div className="flex min-w-0 items-center gap-(--space-3)">
        {children}
        <ThemeToggle compact />
      </div>
    </div>
  );
}
