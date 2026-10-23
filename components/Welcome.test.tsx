import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Welcome } from './Welcome';
import { CONNECT_LABEL, SAMPLE_DAY_LINK } from '@/lib/onboarding';
import { REPLAY_INTRO_LABEL } from '@/lib/intro';

describe('Welcome', () => {
  it('keeps calendar, sample day, replay, and legal links secondary with no Start focusing', () => {
    const onReplayIntro = vi.fn();
    render(
      <Welcome googleConfigured onConnect={() => {}} onReplayIntro={onReplayIntro} />
    );
    expect(screen.queryByTestId('start-focusing')).toBeNull();
    expect(screen.getByTestId('connect-calendar').textContent).toBe(CONNECT_LABEL);
    expect(screen.getByTestId('sample-day').textContent).toBe(SAMPLE_DAY_LINK);
    expect(screen.getByTestId('replay-intro').textContent).toBe(REPLAY_INTRO_LABEL);
    fireEvent.click(screen.getByTestId('replay-intro'));
    expect(onReplayIntro).toHaveBeenCalledTimes(1);
    const secondary = screen.getByTestId('welcome');
    expect(secondary.className).toBe('landing-links');
    expect(screen.getByTestId('connect-calendar').className).not.toMatch(/rounded-full|pill/);
  });

  it('hides connect when Google is not configured', () => {
    render(<Welcome googleConfigured={false} onConnect={() => {}} />);
    expect(screen.queryByTestId('connect-calendar')).toBeNull();
    expect(screen.getByTestId('sample-day').getAttribute('href')).toBe('?mock=back-to-back');
    expect(screen.getByTestId('welcome-about').getAttribute('href')).toBe('/about');
  });
});
