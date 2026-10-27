import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { Banner, Button, Dialog, Icon, Logo, TextField, type IconName } from "@/components/ui";
import { ForfeitDialogDemo, GameSetupDemo, JoinCodeDemo, ToastDemo } from "./demos";

export const metadata: Metadata = {
  title: "Design system",
};

const ICON_NAMES: IconName[] = [
  "radar-sweep", "line-scan", "double-shot", "reroute", "target", "timer", "link",
  "copy", "flag", "rotate", "shuffle", "offline", "player", "ai", "check", "close",
  "arrow-left", "info", "warning",
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-(--space-3) border-t border-line pt-(--space-5)">
      <h2 className="mb-label">{title}</h2>
      {children}
    </section>
  );
}

// dev-only reference page for the ported components
export default function DesignPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center gap-(--space-4) border-b border-line px-(--space-6) py-(--space-3)">
        <Logo size={24} />
        <span className="mb-label flex-1">Design system</span>
        <ThemeToggle />
      </header>

      <main className="mx-auto grid w-full max-w-5xl gap-(--space-5) px-(--space-6) py-(--space-7)">
        <h1 className="text-title">Basic UI</h1>

        <Section title="Logo">
          <div className="mb-row gap-(--space-7)">
            <Logo size={36} />
            <Logo size={24} />
            <Logo size={32} wordmark={false} />
          </div>
        </Section>

        <Section title="Icon">
          <div className="grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-(--space-2)">
            {ICON_NAMES.map((name) => (
              <div key={name} className="grid justify-items-center gap-(--space-2) py-(--space-2)">
                <Icon name={name} size={24} />
                <span className="font-mono text-coord text-ink-muted">{name}</span>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Button">
          <div className="mb-row">
            <Button variant="primary">Create lobby</Button>
            <Button>Join with code</Button>
            <Button variant="ghost" icon="arrow-left">Back</Button>
            <Button variant="danger" icon="flag">Forfeit</Button>
            <Button variant="primary" disabled>Ready · 2 ships left</Button>
          </div>
          <div className="mb-row">
            <Button size="sm" icon="rotate">Rotate</Button>
            <Button size="sm" icon="shuffle">Randomise</Button>
            <Button size="sm" variant="ghost" icon="copy" iconOnly>Copy code</Button>
          </div>
        </Section>

        <Section title="TextField">
          <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-(--space-4)">
            <TextField label="Display name" placeholder="Player123" hint="Optional. Blank becomes Player + 3 digits." />
            <JoinCodeDemo />
            <TextField label="Lobby code" code defaultValue="K7Q2XA" error="No lobby with that code." />
          </div>
        </Section>

        <Section title="SegmentedControl">
          <GameSetupDemo />
        </Section>

        <Section title="Banner">
          <div className="grid max-w-[560px] gap-(--space-2)">
            <Banner tone="info">Reconnecting… your seat is kept.</Banner>
            <Banner tone="warning" action={<Button size="sm" variant="ghost">Forfeit instead</Button>}>
              Teddy lost connection. They have 0:48 to return before you win.
            </Banner>
            <Banner tone="danger" action={<Button size="sm">Retry</Button>}>
              Connection lost. Moves are paused.
            </Banner>
          </div>
        </Section>

        <Section title="Toast">
          <ToastDemo />
        </Section>

        <Section title="Dialog">
          <div className="grid gap-(--space-4)">
            <div>
              <ForfeitDialogDemo />
            </div>
            <div className="overflow-hidden rounded-md">
              <Dialog
                open
                inline
                title="Forfeit this game?"
                actions={
                  <>
                    <Button>Keep playing</Button>
                    <Button variant="danger" icon="flag">Forfeit</Button>
                  </>
                }
              >
                <p>Teddy wins and the result is recorded. You can still ask for a rematch.</p>
              </Dialog>
            </div>
          </div>
        </Section>
      </main>
    </div>
  );
}
