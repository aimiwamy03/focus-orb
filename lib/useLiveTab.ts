import { useEffect, useRef } from 'react';
import { DayModel } from './day';
import { applyOrbFavicon, faviconStateFor, FaviconState, formatLiveTabTitle } from './tab';

const REDRAW_MS = 60 * 1000;

export function useLiveTab(input: {
  model: DayModel;
  now: Date;
  scatter: number;
  isManualFocus: boolean;
  focusMinutes: number | null;
}): string {
  const title = formatLiveTabTitle(input.model, input.now, {
    isManualFocus: input.isManualFocus,
    focusMinutes: input.focusMinutes,
  });
  const state = faviconStateFor({
    scatter: input.scatter,
    state: input.model.state,
  });

  const lastStateRef = useRef<FaviconState | null>(null);
  const lastDrawRef = useRef(0);

  useEffect(() => {
    document.title = title;
  }, [title]);

  useEffect(() => {
    const changed = lastStateRef.current !== state;
    const elapsed = Date.now() - lastDrawRef.current;
    if (!changed && lastStateRef.current !== null && elapsed < REDRAW_MS) {
      return;
    }
    lastStateRef.current = state;
    lastDrawRef.current = Date.now();
    applyOrbFavicon(state);
  }, [state]);

  return title;
}
