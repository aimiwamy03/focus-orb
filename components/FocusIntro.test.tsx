import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { FocusIntro } from './FocusIntro';
import { INTRO_LINES, INTRO_SKIP_HINT } from '@/lib/intro';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('FocusIntro', () => {
  it('renders a frozen rest caption and the skip hint', () => {
    render(
      <FocusIntro soundEnabled={false} reducedMotion={false} freezeAt={1.8} onDone={vi.fn()} />
    );
    expect(screen.getByTestId('focus-intro')).toBeTruthy();
    expect(screen.getByTestId('focus-intro-caption').textContent?.toUpperCase()).toContain(
      'BRAIN'
    );
    expect(screen.getByTestId('focus-intro-hint').textContent).toBe(INTRO_SKIP_HINT);
    expect(INTRO_LINES[1].toLowerCase()).toContain('brain');
    expect(document.querySelector('.focus-intro-fuse')).toBeNull();
  });

  it.each(['Escape', 'Enter', ' '])('skips on %s', (key) => {
    vi.useFakeTimers();
    const onDone = vi.fn();
    render(
      <FocusIntro soundEnabled={false} reducedMotion={false} freezeAt={1.8} onDone={onDone} />
    );
    fireEvent.keyDown(window, { key });
    vi.advanceTimersByTime(300);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('skips on click', () => {
    vi.useFakeTimers();
    const onDone = vi.fn();
    render(
      <FocusIntro soundEnabled={false} reducedMotion={false} freezeAt={1.8} onDone={onDone} />
    );
    fireEvent.pointerDown(screen.getByTestId('focus-intro'));
    vi.advanceTimersByTime(300);
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
