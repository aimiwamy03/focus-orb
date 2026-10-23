'use client';

import {
  ABOUT_LABEL,
  PRIVACY_LABEL,
  TERMS_LABEL,
} from '@/lib/legal';
import { REPLAY_INTRO_LABEL } from '@/lib/intro';
import {
  CONNECT_LABEL,
  SAMPLE_DAY_LINK,
} from '@/lib/onboarding';

interface WelcomeProps {
  onConnect: () => void;
  onReplayIntro?: () => void;
  googleConfigured: boolean;
}

export function Welcome({ onConnect, onReplayIntro, googleConfigured }: WelcomeProps) {
  return (
    <div
      data-testid="welcome"
      data-status="welcome"
      className="landing-links"
    >
      {googleConfigured ? (
        <button
          type="button"
          data-testid="connect-calendar"
          onClick={onConnect}
          className="welcome-secondary-link"
        >
          {CONNECT_LABEL}
        </button>
      ) : null}
      <a href="?mock=back-to-back" data-testid="sample-day" className="welcome-secondary-link">
        {SAMPLE_DAY_LINK}
      </a>
      {onReplayIntro ? (
        <button
          type="button"
          data-testid="replay-intro"
          onClick={onReplayIntro}
          className="welcome-secondary-link"
        >
          {REPLAY_INTRO_LABEL}
        </button>
      ) : null}
      <a href="/about" data-testid="welcome-about" className="welcome-secondary-link">
        {ABOUT_LABEL}
      </a>
      <a href="/privacy" data-testid="welcome-privacy" className="welcome-secondary-link">
        {PRIVACY_LABEL}
      </a>
      <a href="/terms" data-testid="welcome-terms" className="welcome-secondary-link">
        {TERMS_LABEL}
      </a>
    </div>
  );
}
