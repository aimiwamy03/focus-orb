'use client';

import {
  CONNECT_LABEL,
  SAMPLE_DAY_LINK,
  WELCOME_LINE,
} from '@/lib/onboarding';

interface WelcomeProps {
  onConnect: () => void;
  googleConfigured: boolean;
}

export function Welcome({ onConnect, googleConfigured }: WelcomeProps) {
  return (
    <div
      data-testid="status-line"
      className="pointer-events-none absolute bottom-[5.75rem] left-1/2 z-20 w-fit max-w-[min(40rem,90vw)] -translate-x-1/2 text-center font-normal tracking-wide text-orb-dim"
    >
      <div className="text-[length:var(--type-status)] leading-snug">
        <span data-text-clear className="inline-block">
          <button
            type="button"
            data-testid="connect-calendar"
            onClick={onConnect}
            className="pointer-events-auto text-orb-text hover:text-white"
          >
            Connect your calendar
          </button>
          <span className="mx-2 text-orb-quiet">·</span>
          <a
            href="?mock=back-to-back"
            data-testid="sample-day"
            className="pointer-events-auto text-orb-dim underline underline-offset-2 decoration-orb-quiet hover:text-orb-text"
          >
            Try a sample day
          </a>
        </span>
      </div>
    </div>
  );
}
