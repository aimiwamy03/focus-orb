import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

vi.mock('@/app/actions', () => ({ signInWithGoogle: vi.fn() }));

import { PublicHome } from './PublicHome';
import { ABOUT_HEADING, ABOUT_LEDE, PRIVACY_LABEL, TERMS_LABEL } from '@/lib/legal';
import { SAMPLE_DAY_LINK } from '@/lib/onboarding';

afterEach(() => cleanup());

describe('PublicHome', () => {
  it('explains Focus Orb and links to privacy and terms', () => {
    render(<PublicHome />);
    expect(screen.getByTestId('about-heading').textContent).toBe(ABOUT_HEADING);
    expect(screen.getByTestId('about-lede').textContent).toBe(ABOUT_LEDE);
    expect(screen.getByTestId('legal-privacy').textContent).toBe(PRIVACY_LABEL);
    expect(screen.getByTestId('legal-terms').textContent).toBe(TERMS_LABEL);
    expect(screen.getByTestId('sample-day').textContent).toBe(SAMPLE_DAY_LINK);
    expect(screen.getByTestId('about-calendar').textContent).not.toMatch(/[—–]/);
    expect(screen.queryByTestId('focus-intro')).toBeNull();
  });

  it('can start Google sign-in when the client is configured', () => {
    vi.stubEnv('NEXT_PUBLIC_GOOGLE_CONFIGURED', 'true');
    render(<PublicHome />);
    expect(screen.getByTestId('connect-calendar')).toBeTruthy();
    vi.unstubAllEnvs();
  });
});
