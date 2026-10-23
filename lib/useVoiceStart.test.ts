import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useVoiceStart } from './useVoiceStart';

describe('useVoiceStart', () => {
  const onStart = vi.fn();
  const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));

  beforeEach(() => {
    onStart.mockClear();
    fetchMock.mockClear();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('speechSynthesis', { cancel: vi.fn(), speak: vi.fn() });
    vi.stubGlobal(
      'SpeechSynthesisUtterance',
      class {
        text = '';
        constructor(text: string) {
          this.text = text;
        }
      }
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  function setup(
    extra: Partial<Parameters<typeof useVoiceStart>[0]> = {}
  ) {
    return renderHook(() =>
      useVoiceStart({
        enabled: true,
        mock: true,
        gapMinutes: extra.gapMinutes ?? null,
        nextEventTitle: extra.nextEventTitle ?? null,
        whoopOfferMinutes: extra.whoopOfferMinutes ?? null,
        confirmMs: extra.confirmMs ?? 30,
        onStart,
        ...extra,
      })
    );
  }

  it('holds V to listen, then confirms a mock transcript and starts', () => {
    vi.useFakeTimers();
    const { result } = setup();
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'v', bubbles: true, cancelable: true }));
    });
    expect(result.current.phase).toBe('listening');
    act(() => result.current.setMockInput('Orb, 40 minutes on the Mercor application'));
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keyup', { key: 'v', bubbles: true, cancelable: true }));
    });
    expect(result.current.phase).toBe('confirm');
    expect(result.current.pending).toMatchObject({
      minutes: 40,
      label: 'Mercor application',
      adjusted: false,
    });
    act(() => {
      vi.advanceTimersByTime(30);
    });
    expect(onStart).toHaveBeenCalledWith({
      minutes: 40,
      label: 'Mercor application',
      adjusted: false,
    });
    expect(JSON.stringify(fetchMock.mock.calls)).not.toContain('Mercor');
  });

  it('offers a shorter calendar gap and starts that length on yes', () => {
    vi.useFakeTimers();
    const { result } = setup({
      gapMinutes: 30,
      nextEventTitle: 'Standup',
    });
    act(() => result.current.setMockInput('40 minutes on docs'));
    act(() => result.current.submitMock());
    expect(result.current.phase).toBe('conflict');
    expect(result.current.conflict?.prompt).toBe(
      'You have 30 minutes before Standup. Do 30?'
    );
    act(() => result.current.conflictYes());
    expect(result.current.phase).toBe('confirm');
    expect(result.current.pending).toMatchObject({ minutes: 30, adjusted: true });
    act(() => {
      vi.advanceTimersByTime(30);
    });
    expect(onStart).toHaveBeenCalledWith({
      minutes: 30,
      label: 'docs',
      adjusted: true,
    });
  });

  it('asks once after no speech, then shows typed input', () => {
    const { result } = setup();
    act(() => result.current.setMockInput(''));
    act(() => result.current.submitMock());
    expect(result.current.phase).toBe('repeat');
    act(() => result.current.submitMock());
    expect(result.current.phase).toBe('typed');
  });

  it('cancels confirm without starting', () => {
    vi.useFakeTimers();
    const { result } = setup();
    act(() => result.current.setMockInput('25 minutes on writing'));
    act(() => result.current.submitMock());
    expect(result.current.phase).toBe('confirm');
    act(() => result.current.cancelConfirm());
    act(() => {
      vi.advanceTimersByTime(50);
    });
    expect(onStart).not.toHaveBeenCalled();
    expect(result.current.phase).toBe('idle');
  });
});
