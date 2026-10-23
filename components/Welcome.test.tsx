import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Welcome } from './Welcome';
import { CONNECT_LABEL, SAMPLE_DAY_LINK, START_FOCUSING_LABEL } from '@/lib/onboarding';

describe('Welcome', () => {
  it('makes Start focusing the primary action and keeps calendar links secondary', () => {
    const onConnect = vi.fn();
    const onStart = vi.fn();
    render(<Welcome googleConfigured onConnect={onConnect} onStart={onStart} />);
    const start = screen.getByTestId('start-focusing');
    expect(start.textContent).toBe(START_FOCUSING_LABEL);
    expect(start.className).toBe('start-focusing');
    expect(start.className).not.toMatch(/rounded-full|bg-orb-highlight|pill/);
    start.click();
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('connect-calendar').textContent).toBe(CONNECT_LABEL);
    expect(screen.getByTestId('connect-calendar').className).toBe('welcome-secondary-link');
    screen.getByTestId('connect-calendar').click();
    expect(onConnect).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('sample-day').textContent).toBe(SAMPLE_DAY_LINK);
    expect(screen.getByTestId('welcome-about').getAttribute('href')).toBe('/about');
    expect(screen.getByTestId('welcome-privacy').getAttribute('href')).toBe('/privacy');
    expect(screen.getByTestId('welcome-terms').getAttribute('href')).toBe('/terms');
    expect(screen.queryByTestId('welcome-line')).toBeNull();
  });

  it('still offers a sample day when Google is not configured', () => {
    render(<Welcome googleConfigured={false} onConnect={() => {}} onStart={() => {}} />);
    expect(screen.getByTestId('start-focusing').textContent).toBe(START_FOCUSING_LABEL);
    expect(screen.queryByTestId('connect-calendar')).toBeNull();
    expect(screen.getByTestId('sample-day').textContent).toBe(SAMPLE_DAY_LINK);
    expect(screen.getByTestId('welcome-secondary').className).toBe('welcome-secondary');
  });
});
