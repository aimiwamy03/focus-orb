'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { mockWhoopSummary, parseWhoopQuery } from './whoop.mock';
import {
  cachedSummaryIsFresh,
  clearCachedWhoopSummary,
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
  const [mode, setModeState] = useState<WhoopMode>(loadWhoopMode);
  const [showNumbers, setShowNumbersState] = useState(loadWhoopShowNumbers);
  const [hidden, setHidden] = useState(isWhoopLineHidden);
  const [fetched, setFetched] = useState<WhoopCachedSummary | null>(loadCachedWhoopSummary);
  const mockSummary = mockKey ? mockWhoopSummary(mockKey, nowMs) : null;
  const summary = mockSummary ?? fetched;

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
        if (data.connected) saveCachedWhoopSummary({ ...data, fetchedAt: Date.now() });
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
    connect: () => {
      if (mockKey) return;
      // Full navigation: the connect route sets an httpOnly cookie and 302s to WHOOP.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = '/api/whoop/connect';
    },
    disconnect: async () => {
      if (!mockKey) {
        try {
          await fetch('/api/whoop/disconnect', { method: 'POST' });
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
