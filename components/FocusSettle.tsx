'use client';

import { useEffect } from 'react';
import { SETTLE_SKIP_HINT, isSettleSkipKey } from '@/lib/orbGrowth';

export function FocusSettle({ onSkip }: { onSkip: (skipped: boolean) => void }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!isSettleSkipKey(event.key)) return;
      event.preventDefault();
      onSkip(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onSkip]);

  return (
    <div
      data-testid="focus-settle"
      data-text-clear
      className="pointer-events-auto flex flex-col items-center gap-3 text-center"
      onPointerDown={() => onSkip(true)}
    >
      <p
        data-testid="settle-hint"
        className="m-0 text-[length:var(--type-whoop)] leading-snug text-orb-text"
      >
        {SETTLE_SKIP_HINT}
      </p>
    </div>
  );
}
