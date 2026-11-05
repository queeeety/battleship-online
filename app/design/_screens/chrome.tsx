"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";

// the strip above a sample screen; not part of the screen itself
export function ShowcaseStrip({ name, children }: { name: string; children?: ReactNode }) {
  return (
    // one line at every width; on phones only the back arrow and the sample switches stay
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
