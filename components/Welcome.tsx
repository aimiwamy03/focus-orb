'use client';

import {
  ABOUT_LABEL,
  PRIVACY_LABEL,
  TERMS_LABEL,
} from '@/lib/legal';
import {
  CONNECT_LABEL,
  SAMPLE_DAY_LINK,
  START_FOCUSING_LABEL,
} from '@/lib/onboarding';

interface WelcomeProps {
  onConnect: () => void;
  onStart: () => void;
  googleConfigured: boolean;
}

export function Welcome({ onConnect, onStart, googleConfigured }: WelcomeProps) {
  return (
    <div
      data-testid="welcome"
      data-status="welcome"
      className="welcome-handoff"
    >
      <button
        type="button"
        data-testid="start-focusing"
        onClick={onStart}
        className="start-focusing"
      >
        {START_FOCUSING_LABEL}
      </button>
      <div data-testid="welcome-secondary" className="welcome-secondary">
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
    </div>
  );
}
