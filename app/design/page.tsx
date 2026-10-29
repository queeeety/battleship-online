import type { Metadata } from "next";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import {
  AbilityCard,
  AbilityDraw,
  Board,
  FleetStatus,
  Legend,
  PlayerChip,
  RematchPanel,
  ResultSummary,
  Ship,
  TurnIndicator,
  TurnTimer,
  type RematchState,
  type ShipPlacement,
  type ShipType,
} from "@/components/game";
import { Banner, Button, Dialog, Icon, Logo, TextField, type IconName } from "@/components/ui";
import {
  AbilityCardDemo,
  AbilityDrawDemo,
  FleetPlacementDemo,
  ForfeitDialogDemo,
  GameSetupDemo,
  JoinCodeDemo,
  LobbyCodeDemo,
  ShotLogDemo,
  TargetBoardDemo,
  ToastDemo,
  TurnTimerDemo,
} from "./demos";

export const metadata: Metadata = {
  title: "Design system",
};

const ICON_NAMES: IconName[] = [
  "radar-sweep", "line-scan", "double-shot", "reroute", "target", "timer", "link",
  "copy", "flag", "rotate", "shuffle", "offline", "player", "ai", "check", "close",
  "arrow-left", "info", "warning",
];

const SHIP_TYPES: ShipType[] = ["carrier", "battleship", "cruiser", "submarine", "destroyer"];

const OWN_SHIPS: ShipPlacement[] = [
  { type: "carrier", x: 1, y: 1, orientation: "horizontal" },
  { type: "battleship", x: 8, y: 2, orientation: "vertical", status: "damaged" },
  { type: "cruiser", x: 2, y: 5, orientation: "vertical" },
  { type: "submarine", x: 5, y: 7, orientation: "horizontal", status: "sunk" },
  { type: "destroyer", x: 4, y: 4, orientation: "horizontal" },
];

const OWN_MARKS = {
  I4: "hit", C3: "miss", G3: "miss", A9: "miss", F8: "sunk", G8: "sunk", H8: "sunk", J10: "miss", E6: "miss",
} as const;

const REMATCH_STATES: RematchState[] = ["none", "requested-by-you", "requested-by-opponent", "accepted", "declined"];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-(--space-3) border-t border-line pt-(--space-5)">
      <h2 className="mb-label">{title}</h2>
      {children}
    </section>
  );
}

// reference page for the ported components
export default function DesignPage() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center gap-(--space-4) border-b border-line px-(--space-6) py-(--space-3)">
        <Logo size={24} />
        <span className="mb-label flex-1">Design system</span>
        <ThemeToggle />
      </header>

      <main className="mx-auto grid w-full max-w-5xl gap-(--space-5) px-(--space-6) py-(--space-7)">
        <h1 className="text-title">Basic UI</h1>
        <nav className="mb-row gap-(--space-4) text-small" aria-label="Sections">
          <a className="text-sonar underline" href="#game">
            Game components
          </a>
          <Link className="text-sonar underline" href="/design/home">
            Home screen
          </Link>
          <Link className="text-sonar underline" href="/design/placement">
            Placement screen
          </Link>
          <Link className="text-sonar underline" href="/design/battle">
            Battle screen
          </Link>
        </nav>

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

        <h1 id="game" className="mt-(--space-7) scroll-mt-(--space-5) text-title">
          Game components
        </h1>

        <Section title="Board">
          <p className="text-small text-ink-muted">
            The target board is live: click a cell to fire, or Tab to the board, move with the arrow keys and press
            Enter. Cells already fired at can&apos;t be fired at again.
          </p>
          <div className="flex flex-wrap items-start gap-(--space-6)">
            <TargetBoardDemo />
            <div className="grid gap-(--space-3)">
              <Board variant="own" title="Your waters" meta="4 of 5 afloat" marks={OWN_MARKS} ships={OWN_SHIPS} />
              <Legend />
            </div>
          </div>
        </Section>

        <Section title="Ship">
          <div className="grid gap-(--space-4)" style={{ "--mb-cell": "34px" } as CSSProperties}>
            <div className="mb-row gap-(--space-4)">
              {SHIP_TYPES.map((type) => (
                <Ship key={type} type={type} />
              ))}
            </div>
            <div className="flex flex-wrap items-start gap-(--space-4)">
              <Ship type="cruiser" status="sunk" />
              <Ship type="battleship" ghost="valid" />
              <Ship type="battleship" ghost="invalid" />
              <Ship type="battleship" orientation="vertical" />
              <Ship type="submarine" orientation="vertical" status="sunk" />
            </div>
          </div>
        </Section>

        <Section title="FleetStatus">
          <div className="flex flex-wrap items-start gap-(--space-4)">
            <div className="w-[280px]">
              <FleetStatus
                fleet={[
                  { type: "carrier" },
                  { type: "battleship", hits: 2 },
                  { type: "cruiser" },
                  { type: "submarine", sunk: true },
                  { type: "destroyer", hits: 1 },
                ]}
              />
            </div>
            <div className="w-[280px]">
              <FleetPlacementDemo />
            </div>
          </div>
        </Section>

        <Section title="TurnIndicator">
          <div className="grid w-[300px] gap-(--space-1)">
            <TurnIndicator turn="you" turnNumber={7} />
            <TurnIndicator turn="opponent" turnNumber={8} opponentName="Teddy" />
            <TurnIndicator turn="ai" turnNumber={8} />
          </div>
        </Section>

        <Section title="TurnTimer">
          <p className="text-small text-ink-muted">The first one counts down from 15 and loops.</p>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] items-start gap-(--space-4)">
            <TurnTimerDemo />
            <TurnTimer seconds={4} total={15} />
            <TurnTimer seconds={21} total={30} paused />
            <TurnTimer seconds={3} total={5} size="sm" />
          </div>
        </Section>

        <Section title="AbilityCard">
          <div className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] items-start gap-(--space-4)">
            <AbilityCardDemo />
            <AbilityCard ability="line-scan" state="armed" />
            <AbilityCard ability="double-shot" state="unavailable" />
            <AbilityCard ability={null} />
          </div>
        </Section>

        <Section title="AbilityDraw">
          <div className="grid max-w-[520px] gap-(--space-4)">
            <AbilityDraw current="reroute" drawn="radar-sweep" />
            <AbilityDrawDemo />
          </div>
        </Section>

        <Section title="ShotLog">
          <ShotLogDemo />
        </Section>

        <Section title="LobbyCode">
          <LobbyCodeDemo />
        </Section>

        <Section title="PlayerChip">
          <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-(--space-2)">
            <PlayerChip name="Tim" you host ready />
            <PlayerChip name="Teddy" ready={false} />
            <PlayerChip name="Player417" presence="away" />
            <PlayerChip name="Nathan" presence="offline" />
            <PlayerChip name="AI · Normal" ai />
          </div>
        </Section>

        <Section title="ResultSummary">
          <div className="flex flex-wrap items-start gap-(--space-4)">
            <div className="w-[380px] max-w-full">
              <ResultSummary didWin reason="FLEET_DESTROYED" shotsFired={41} accuracy={0.41} shipsSunk={5} />
            </div>
            <div className="w-[380px] max-w-full">
              <ResultSummary didWin={false} reason="OPPONENT_FORFEIT" shotsFired={23} accuracy={0.3} shipsSunk={2} />
            </div>
          </div>
        </Section>

        <Section title="RematchPanel">
          <div className="grid max-w-[460px] gap-(--space-3)">
            {REMATCH_STATES.map((status) => (
              <div key={status} className="border-t border-line pt-(--space-3)">
                <RematchPanel status={status} opponentName="Teddy" />
              </div>
            ))}
          </div>
        </Section>
      </main>
    </div>
  );
}
