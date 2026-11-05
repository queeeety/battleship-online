"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import { Button, TextField } from "@/components/ui";
import { PLAYER_NAME_MAX_LENGTH } from "@/lib/config";
import { SCREEN, ScreenBar } from "./chrome";

export interface JoinViewProps {
  code: string;
  name: string;
  onNameChange: (name: string) => void;
  onJoin: () => void;
  pending?: boolean;
  /** Under the name field, e.g. "Name not allowed". */
  nameError?: string;
  /** Under the button, e.g. "Lobby is full". */
  error?: string;
}

export function JoinView({ code, name, onNameChange, onJoin, pending, nameError, error }: JoinViewProps) {
  function submit(e: FormEvent) {
    e.preventDefault();
    if (!pending) onJoin();
  }

  return (
    <div className={SCREEN}>
      <ScreenBar homeHref="/" />
      <main className="mx-auto grid w-full max-w-[880px] content-start px-(--space-4) pt-(--space-5) pb-(--space-6) min-[900px]:px-(--space-6)">
        <form className="grid w-full max-w-md content-start gap-(--space-4) justify-self-center" onSubmit={submit}>
          <div className="grid gap-(--space-1)">
            <span className="mb-label">You&apos;re invited</span>
            <h1 className="text-title">
              Join game <span className="font-mono">{code}</span>
            </h1>
          </div>
          <TextField
            label="Display name"
            placeholder="Player123"
            hint="Optional. Blank becomes Player + 3 digits."
            maxLength={PLAYER_NAME_MAX_LENGTH}
            value={name}
            onChange={onNameChange}
            error={nameError}
          />
          <Button type="submit" variant="primary" disabled={pending} aria-busy={pending}>
            {pending ? "Joining…" : "Join game"}
          </Button>
          {error && (
            <p className="text-danger" role="alert">
              {error}
            </p>
          )}
          <Link href="/" className="mb-label justify-self-start hover:text-ink">
            Back to home
          </Link>
        </form>
      </main>
    </div>
  );
}
