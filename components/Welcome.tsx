'use client';

interface WelcomeProps {
  onConnect: () => void;
}

export function Welcome({ onConnect }: WelcomeProps) {
  return (
    <div
      data-testid="status-line"
      className="pointer-events-none absolute bottom-[5.75rem] left-1/2 z-20 w-[min(36rem,80vw)] -translate-x-1/2 px-4 text-center font-normal tracking-wide text-white/70"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-28 w-[32rem] max-w-[90vw] -translate-x-1/2 -translate-y-1/2"
        style={{
          background:
            'radial-gradient(ellipse at center, rgba(22,22,22,0.80) 0%, rgba(22,22,22,0.55) 42%, rgba(22,22,22,0) 72%)',
        }}
      />
      <div className="relative text-[12px] leading-5">
        <span data-text-clear className="inline-block">
          <button
            type="button"
            data-testid="connect-calendar"
            onClick={onConnect}
            className="pointer-events-auto text-white/80 hover:text-white"
          >
            Connect your calendar
          </button>
          <span className="mx-2 text-white/25">·</span>
          <a
            href="?mock=back-to-back"
            data-testid="sample-day"
            className="pointer-events-auto text-white/45 underline underline-offset-2 decoration-white/30 hover:text-white/70"
          >
            Try a sample day
          </a>
        </span>
      </div>
    </div>
  );
}
