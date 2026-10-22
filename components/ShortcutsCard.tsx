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
      className="fixed top-4 left-4 z-40 max-w-xs space-y-2 text-[length:var(--type-hint)] leading-5 text-orb-dim"
    >
      <ul className="space-y-2">
        {SHORTCUT_ROWS.map((row) => (
          <li key={row.key} className="flex items-center gap-2">
            <KeyHint label={row.key} />
            <span>{row.action}</span>
          </li>
        ))}
      </ul>
      <button
        type="button"
        data-testid="shortcuts-got-it"
        onClick={onDismiss}
        className="text-[length:var(--type-hint)] tracking-wide text-orb-quiet hover:text-orb-dim"
      >
        {GOT_IT_LABEL}
      </button>
    </div>
  );
}
