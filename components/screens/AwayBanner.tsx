import { Banner } from "@/components/ui";

// the banner is an alert, so screen readers get a version without the ticking seconds
export function AwayBanner({ name, secondsLeft }: { name: string; secondsLeft: number }) {
  return (
    <Banner tone="warning" icon="offline">
      {secondsLeft > 0 ? (
        <>
          <span className="sr-only">{name} lost connection. If they don&apos;t come back in time, you win.</span>
          <span aria-hidden>
            {name} lost connection. If they&apos;re not back in {secondsLeft} s, you win.
          </span>
        </>
      ) : (
        `${name} didn't come back. Claiming the win…`
      )}
    </Banner>
  );
}
