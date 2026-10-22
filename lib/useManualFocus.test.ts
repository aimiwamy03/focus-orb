import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { draftFocusEnd, useManualFocus } from './useManualFocus';

const session = {
  startTime: 1_700_000_000_000,
  duration: 25,
  task: 'write the spec',
  kind: 'focus' as const,
};

describe('draftFocusEnd', () => {
  it('records completed, ended-early, and end-session blocks', () => {
    expect(draftFocusEnd(session, 'completed', session.startTime + 25 * 60_000)).toEqual({
      task: 'write the spec',
      startMs: session.startTime,
      endMs: session.startTime + 25 * 60_000,
      minutes: 25,
      planned: 25,
      ended: 'completed',
    });
    expect(draftFocusEnd(session, 'ended-early', session.startTime + 18 * 60_000)).toMatchObject({
      minutes: 18,
      planned: 25,
      ended: 'ended-early',
    });
    expect(draftFocusEnd(session, 'ended-session', session.startTime + 7 * 60_000)).toMatchObject({
      minutes: 7,
      planned: 25,
      ended: 'ended-session',
    });
  });
});

describe('useManualFocus logging', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('records focus ends and skips breaks', () => {
    const onFocusEnded = vi.fn();
    const { result } = renderHook(() => useManualFocus({ onFocusEnded }));

    act(() => result.current.startFocus(25, 'write the spec'));
    act(() => result.current.stopFocus());
    expect(onFocusEnded).toHaveBeenCalledTimes(1);
    expect(onFocusEnded.mock.calls[0][0]).toMatchObject({
      task: 'write the spec',
      planned: 25,
      ended: 'ended-early',
    });

    onFocusEnded.mockClear();
    act(() => result.current.startBreak());
    act(() => result.current.stopFocus());
    expect(onFocusEnded).not.toHaveBeenCalled();
    act(() => result.current.endSession());
    expect(onFocusEnded).not.toHaveBeenCalled();

    act(() => result.current.startFocus(50, 'review pr'));
    act(() => result.current.endSession());
    expect(onFocusEnded).toHaveBeenCalledTimes(1);
    expect(onFocusEnded.mock.calls[0][0]).toMatchObject({
      task: 'review pr',
      planned: 50,
      ended: 'ended-session',
    });
  });

  it('records a completed block when the timer finishes', () => {
    vi.useFakeTimers();
    const onFocusEnded = vi.fn();
    const { result } = renderHook(() => useManualFocus({ onFocusEnded }));
    act(() => result.current.startFocus(1, 'finish voice ai post'));
    act(() => {
      vi.advanceTimersByTime(61_000);
    });
    expect(onFocusEnded).toHaveBeenCalledTimes(1);
    expect(onFocusEnded.mock.calls[0][0]).toMatchObject({
      task: 'finish voice ai post',
      minutes: 1,
      planned: 1,
      ended: 'completed',
    });
    vi.useRealTimers();
  });
});
