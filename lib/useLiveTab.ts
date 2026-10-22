import { useEffect, useRef } from 'react';
import { DayModel } from './day';
import { applyOrbFavicon, faviconStateFor, FaviconState } from './tab';

const REDRAW_MS = 60 * 1000;

export function useLiveTab(input: {
  model: DayModel;
  scatter: number;
  isManualFocus: boolean;
}): void {
  const state = faviconStateFor({
    scatter: input.scatter,
    state: input.model.state,
    isManualFocus: input.isManualFocus,
  });

  const lastStateRef = useRef<FaviconState | null>(null);
  const lastDrawRef = useRef(0);

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
}
