'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { signInWithGoogle } from '@/app/actions';
import { mockWhoopSummary, parseWhoopQuery } from './whoop.mock';
import {
  cachedSummaryIsFresh,
  clearCachedWhoopSummary,
  DEFAULT_WHOOP_MODE,
  WHOOP_INVITE_ONLY_MESSAGE,
  hideWhoopLineForToday,
  isWhoopLineHidden,
  loadCachedWhoopSummary,
  loadWhoopMode,
  loadWhoopShowNumbers,
  saveCachedWhoopSummary,
  saveWhoopMode,
  saveWhoopShowNumbers,
  shouldStopWhoopNudge,
  suggestWhoop,
  type WhoopCachedSummary,
  type WhoopMode,
} from './whoop';

export function useWhoop() {
  const searchParams = useSearchParams();
  const mockKey = parseWhoopQuery(searchParams.get('whoop'));
  const [nowMs] = useState(() => Date.now());
  const [mode, setModeState] = useState<WhoopMode>(DEFAULT_WHOOP_MODE);
  const [showNumbers, setShowNumbersState] = useState(true);
  const [hidden, setHidden] = useState(false);
  const [fetched, setFetched] = useState<WhoopCachedSummary | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const mockSummary = mockKey ? mockWhoopSummary(mockKey, nowMs) : null;
  const summary = mockSummary ?? fetched;
  const whoopError = searchParams.get('whoopError');

  useEffect(() => {
    setModeState(loadWhoopMode());
    setShowNumbersState(loadWhoopShowNumbers());
    setHidden(isWhoopLineHidden());
    if (!mockKey) setFetched(loadCachedWhoopSummary());
    if (whoopError === 'invite') setMessage(WHOOP_INVITE_ONLY_MESSAGE);
  }, [mockKey, whoopError]);

  useEffect(() => {
    if (mockKey) return;
    let cancelled = false;
    const run = async () => {
      const light = loadWhoopMode() === 'off';
      try {
        const response = await fetch(light ? '/api/whoop/today?light=1' : '/api/whoop/today');
        if (!response.ok || cancelled) return;
        const data = (await response.json()) as WhoopCachedSummary;
        if (cancelled) return;
        setFetched(data);
        if (data.message) setMessage(data.message);
        if (data.connected && data.status !== 'disconnected') {
          saveCachedWhoopSummary({ ...data, fetchedAt: Date.now() });
        } else {
          clearCachedWhoopSummary();
        }
      } catch {
        if (cancelled) return;
        const cached = loadCachedWhoopSummary();
        if (cached && cachedSummaryIsFresh(cached)) setFetched(cached);
      }
    };

    void run();
    const onVis = () => {
      if (document.visibilityState === 'visible') void run();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [mockKey]);

  const suggestion =
    summary?.facts && mode !== 'off' ? suggestWhoop(summary.facts, showNumbers) : null;
  const stopNudge = suggestion ? shouldStopWhoopNudge(suggestion.lineKey) : false;
  const offerMinutes =
    suggestion && !stopNudge && suggestion.lineKey !== 'pending'
      ? suggestion.rhythm.firstBlockMinutes
      : null;
  const breakMinutes =
    mode === 'adapt' && suggestion && !stopNudge ? suggestion.rhythm.breakMinutes : null;
  const line = hidden || mode === 'off' ? null : suggestion?.line ?? null;

  return {
    mockKey,
    mode,
    setMode: (next: WhoopMode) => {
      setModeState(next);
      saveWhoopMode(next);
    },
    showNumbers,
    setShowNumbers: (next: boolean) => {
      setShowNumbersState(next);
      saveWhoopShowNumbers(next);
    },
    summary,
    suggestion,
    line,
    offerMinutes,
    breakMinutes,
    stopNudge,
    hideLine: () => {
      hideWhoopLineForToday();
      setHidden(true);
    },
    message,
    connect: async () => {
      if (mockKey) return;
      try {
        const response = await fetch('/api/whoop/connect?json=1');
        const data = (await response.json()) as { error?: string; redirect?: string };
        if (response.status === 401) {
          await signInWithGoogle();
          return;
        }
        if (!response.ok) {
          setMessage(data.error ?? WHOOP_INVITE_ONLY_MESSAGE);
          return;
        }
        if (data.redirect) {
          window.location.href = data.redirect;
        }
      } catch {
        setMessage(WHOOP_INVITE_ONLY_MESSAGE);
      }
    },
    disconnect: async () => {
      if (!mockKey) {
        try {
          const response = await fetch('/api/whoop/disconnect', { method: 'POST' });
          const data = (await response.json()) as { message?: string };
          if (data.message) setMessage(data.message);
        } catch {
          // Local data still goes away.
        }
      }
      clearCachedWhoopSummary();
      setFetched({
        connected: false,
        email: null,
        status: 'disconnected',
        facts: null,
        fetchedAt: Date.now(),
      });
    },
    demo: Boolean(mockKey),
  };
}
