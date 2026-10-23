import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Welcome } from './Welcome';
import { CONNECT_LABEL, SAMPLE_DAY_LINK, WELCOME_LINE } from '@/lib/onboarding';

describe('Welcome', () => {
  it('calls through to Google sign-in when configured', () => {
    const onConnect = vi.fn();
    render(<Welcome googleConfigured onConnect={onConnect} />);
    expect(screen.getByTestId('connect-calendar').textContent).toBe(CONNECT_LABEL);
    screen.getByTestId('connect-calendar').click();
    expect(onConnect).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('sample-day').textContent).toBe(SAMPLE_DAY_LINK);
    expect(screen.getByTestId('welcome-about').getAttribute('href')).toBe('/about');
    expect(screen.getByTestId('welcome-privacy').getAttribute('href')).toBe('/privacy');
    expect(screen.getByTestId('welcome-terms').getAttribute('href')).toBe('/terms');
  });

  it('falls back to plain copy and a sample day when Google is not configured', () => {
    render(<Welcome googleConfigured={false} onConnect={() => {}} />);
    expect(screen.getByTestId('welcome-line').textContent).toBe(WELCOME_LINE);
    expect(screen.queryByTestId('connect-calendar')).toBeNull();
    expect(screen.getByTestId('sample-day').textContent).toBe(SAMPLE_DAY_LINK);
    expect(screen.getByTestId('welcome-about').getAttribute('href')).toBe('/about');
    expect(screen.getByTestId('welcome-privacy').getAttribute('href')).toBe('/privacy');
  });
});
