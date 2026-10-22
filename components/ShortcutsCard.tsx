'use client';

import { useEffect } from 'react';
import {
  GOT_IT_LABEL,
  SHORTCUT_ROWS,
  SHORTCUTS_CARD_MS,
} from '@/lib/shortcuts';
import { KeyHint } from './KeyHint';

interface ShortcutsCardProps {
  onDismiss: () => void;
}

export function ShortcutsCard({ onDismiss }: ShortcutsCardProps) {
  useEffect(() => {
    const timeout = window.setTimeout(onDismiss, SHORTCUTS_CARD_MS);
    return () => window.clearTimeout(timeout);
  }, [onDismiss]);

  return (
    <div
      data-testid="shortcuts-card"
      data-text-clear
      className="relative z-20 w-[min(16rem,86vw)] shrink-0 rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-center"
    >
      <ul className="space-y-1">
        {SHORTCUT_ROWS.map((row) => (
          <li
            key={row.key}
            className="flex items-center justify-center gap-2 text-[11px] leading-4 text-white/40"
          >
            <KeyHint label={row.key} />
            <span>{row.action}</span>
          </li>
        ))}
      </ul>
      <button
        type="button"
        data-testid="shortcuts-got-it"
        onClick={onDismiss}
        className="mt-2 text-[11px] tracking-wide text-white/45 hover:text-white/70"
      >
        {GOT_IT_LABEL}
      </button>
    </div>
  );
}
