import { ThemeToggle } from "@/components/theme/ThemeToggle";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-(--space-5) px-(--space-6) py-(--space-7)">
      <h1 className="text-display">MyBattleship</h1>
      <p className="max-w-md text-ink-muted">
        Share a lobby code, take timed turns and use abilities to find the
        enemy fleet first.
      </p>
      <div>
        <ThemeToggle />
      </div>
    </main>
  );
}
