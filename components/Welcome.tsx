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
      className="pointer-events-none absolute bottom-[5.75rem] left-1/2 z-20 w-fit max-w-[min(36rem,80vw)] -translate-x-1/2 text-center font-normal tracking-wide text-orb-dim"
    >
      <div className="text-[12px] leading-5">
        {googleConfigured ? (
          <span data-text-clear className="inline-block">
            <button
              type="button"
              data-testid="connect-calendar"
              onClick={onConnect}
              className="pointer-events-auto text-orb-text hover:text-white"
            >
              {CONNECT_LABEL}
            </button>
            <span className="mx-2 text-orb-quiet">·</span>
            <a
              href="?mock=back-to-back"
              data-testid="sample-day"
              className="pointer-events-auto text-orb-quiet underline underline-offset-2 decoration-orb-quiet/40 hover:text-orb-text"
            >
              {SAMPLE_DAY_LINK}
            </a>
          </span>
        ) : (
          <span data-text-clear className="inline-block space-y-2">
            <span data-testid="welcome-line" className="block text-orb-dim">
              {WELCOME_LINE}
            </span>
            <a
              href="?mock=back-to-back"
              data-testid="sample-day"
              className="pointer-events-auto text-orb-text underline underline-offset-2 decoration-orb-quiet/40 hover:text-white"
            >
              {SAMPLE_DAY_LINK}
            </a>
          </span>
        )}
      </div>
    </div>
  );
}
