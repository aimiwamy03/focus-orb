'use client';

import Link from 'next/link';
import { signInWithGoogle } from '@/app/actions';
import {
  ABOUT_CALENDAR_BODY,
  ABOUT_CALENDAR_HEADING,
  ABOUT_HEADING,
  ABOUT_LEDE,
  ABOUT_WHAT_BODY,
  ABOUT_WHAT_HEADING,
  OPEN_APP_LABEL,
  PRIVACY_LABEL,
  TERMS_LABEL,
} from '@/lib/legal';
import { CONNECT_LABEL, SAMPLE_DAY_LINK, isGoogleConfigured } from '@/lib/onboarding';
import { LegalChrome, LegalSection } from './LegalChrome';

export function PublicHome({
  current = 'home',
}: {
  current?: 'home' | 'about';
}) {
  const googleConfigured = isGoogleConfigured();

  return (
    <LegalChrome current={current}>
      <header className="flex flex-col gap-4">
        <h1
          data-testid="about-heading"
          className="text-[length:var(--type-heading)] font-semibold leading-tight text-orb-text"
        >
          {ABOUT_HEADING}
        </h1>
        <p
          data-testid="about-lede"
          className="m-0 text-[length:var(--type-whoop)] leading-relaxed text-orb-text"
        >
          {ABOUT_LEDE}
        </p>
      </header>

      <LegalSection heading={ABOUT_WHAT_HEADING} testId="about-what">
        {ABOUT_WHAT_BODY}
      </LegalSection>

      <LegalSection heading={ABOUT_CALENDAR_HEADING} testId="about-calendar">
        {ABOUT_CALENDAR_BODY} Read more in{' '}
        <Link href="/privacy" className="underline underline-offset-4">
          {PRIVACY_LABEL}
        </Link>
        {' and '}
        <Link href="/terms" className="underline underline-offset-4">
          {TERMS_LABEL}
        </Link>
        .
      </LegalSection>

      <div className="flex flex-col items-start gap-4 text-[length:var(--type-whoop)] leading-snug">
        {googleConfigured ? (
          <button
            type="button"
            data-testid="connect-calendar"
            onClick={() => void signInWithGoogle()}
            className="bg-transparent text-orb-text underline decoration-1 underline-offset-4 hover:text-white"
          >
            {CONNECT_LABEL}
          </button>
        ) : null}
        <a
          href="/?mock=back-to-back"
          data-testid="sample-day"
          className="text-orb-text underline decoration-1 underline-offset-4 hover:text-white"
        >
          {SAMPLE_DAY_LINK}
        </a>
        {current === 'about' ? (
          <Link
            href="/"
            data-testid="open-app"
            className="text-orb-text underline decoration-1 underline-offset-4 hover:text-white"
          >
            {OPEN_APP_LABEL}
          </Link>
        ) : null}
      </div>
    </LegalChrome>
  );
}
