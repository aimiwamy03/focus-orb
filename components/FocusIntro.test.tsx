import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { FocusIntro } from './FocusIntro';
import { INTRO_LINES, INTRO_SKIP_HINT } from '@/lib/intro';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function stubBlockedThenRunningAudio() {
  let attempts = 0;
  class FakeAudioContext {
    state = 'suspended';
    currentTime = 0;
    destination = {};
    resume = async () => {
      attempts += 1;
      this.state = attempts > 1 ? 'running' : 'suspended';
    };
    close = async () => undefined;
    createGain() {
      return {
        connect: vi.fn(),
        disconnect: vi.fn(),
        gain: {
          value: 1,
          cancelScheduledValues: vi.fn(),
          setValueAtTime: vi.fn(),
          linearRampToValueAtTime: vi.fn(),
        },
      };
    }
    createDynamicsCompressor() {
      return {
        connect: vi.fn(),
        threshold: { value: 0 },
        ratio: { value: 0 },
        attack: { value: 0 },
        release: { value: 0 },
      };
    }
    createBufferSource() {
      return { buffer: null, connect: vi.fn(), start: vi.fn(), stop: vi.fn() };
    }
    decodeAudioData = async () => ({ duration: 8 });
  }
  vi.stubGlobal('AudioContext', FakeAudioContext);
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(new ArrayBuffer(8)))
  );
  return {
    attempts: () => attempts,
  };
}

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
    expect(screen.getByTestId('focus-intro-hint').tagName).toBe('BUTTON');
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

  it('skips when Skip (Esc) is clicked', () => {
    vi.useFakeTimers();
    const onDone = vi.fn();
    render(
      <FocusIntro soundEnabled={false} reducedMotion={false} freezeAt={1.8} onDone={onDone} />
    );
    fireEvent.click(screen.getByTestId('focus-intro-hint'));
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

  it('retries sound on the first click if autoplay is blocked, with no prompt', async () => {
    const audio = stubBlockedThenRunningAudio();
    const onDone = vi.fn();
    render(<FocusIntro soundEnabled reducedMotion={false} freezeAt={null} onDone={onDone} />);
    await vi.waitFor(() => expect(audio.attempts()).toBeGreaterThan(0));
    await Promise.resolve();
    await Promise.resolve();
    fireEvent.pointerDown(screen.getByTestId('focus-intro'));
    expect(onDone).not.toHaveBeenCalled();
    expect(screen.queryByText(/allow sound|click to play|unmute|sound prompt/i)).toBeNull();
    await vi.waitFor(() => expect(audio.attempts()).toBeGreaterThan(1));
  });

  it('retries sound on the first non-skip key if autoplay is blocked', async () => {
    const audio = stubBlockedThenRunningAudio();
    const onDone = vi.fn();
    render(<FocusIntro soundEnabled reducedMotion={false} freezeAt={null} onDone={onDone} />);
    await vi.waitFor(() => expect(audio.attempts()).toBeGreaterThan(0));
    await Promise.resolve();
    await Promise.resolve();
    fireEvent.keyDown(window, { key: 'a' });
    expect(onDone).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(audio.attempts()).toBeGreaterThan(1));
  });
});
