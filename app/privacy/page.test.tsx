import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import PrivacyPage from './page';
import TermsPage from '../terms/page';
import {
  CONTACT_EMAIL,
  PRIVACY_HEADING,
  PRIVACY_LIMITED_USE,
  TERMS_HEADING,
} from '@/lib/legal';

afterEach(() => cleanup());

describe('verification pages', () => {
  it('renders privacy and terms without an intro', () => {
    render(<PrivacyPage />);
    expect(screen.getByTestId('privacy-heading').textContent).toBe(PRIVACY_HEADING);
    expect(screen.getByTestId('privacy-data').textContent).toMatch(/read-only/i);
    expect(screen.getByTestId('privacy-share').textContent).toMatch(/does not sell/i);
    expect(screen.getByTestId('privacy-store').textContent).toMatch(/database/i);
    expect(screen.getByTestId('privacy-revoke').textContent).toMatch(/permissions/i);
    expect(screen.getByTestId('privacy-contact').textContent).toContain(CONTACT_EMAIL);
    expect(screen.getByTestId('privacy-limited-use').textContent).toContain(PRIVACY_LIMITED_USE);
    expect(screen.getByTestId('privacy-whoop').textContent).toMatch(/whoop_session cookie/);
    expect(screen.getByTestId('privacy-whoop').textContent).toMatch(/invite-only/);
    expect(screen.getByTestId('legal-health-data').textContent).toBe('Health data');
    expect(screen.getByTestId('legal-page').textContent).not.toMatch(/[—–]/);
    cleanup();

    render(<TermsPage />);
    expect(screen.getByTestId('terms-heading').textContent).toBe(TERMS_HEADING);
    expect(screen.getByTestId('terms-body').textContent).toMatch(/as is/);
    expect(screen.queryByTestId('orb-canvas')).toBeNull();
  });
});
