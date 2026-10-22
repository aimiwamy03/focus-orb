'use client';

import { useEffect } from 'react';
import {
  GOT_IT_LABEL,
  SHORTCUT_TIPS_ROWS,
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
      className="fixed top-4 right-4 z-40 space-y-2 text-[length:var(--type-hint)] leading-5 text-orb-dim [text-shadow:0_0_14px_rgba(0,0,0,0.9),0_1px_2px_rgba(0,0,0,0.8)]"
    >
      <ul className="space-y-2">
        {SHORTCUT_TIPS_ROWS.map((row) => (
          <li key={row.id} className="flex items-center justify-end gap-2">
            <span>{row.action}</span>
            <KeyHint label={row.key} />
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
