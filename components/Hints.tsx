'use client';

import { useEffect, useState } from 'react';
import { SHORTCUT_ROWS, SHORTCUTS_LABEL } from '@/lib/shortcuts';
import { KeyHint } from './KeyHint';

const HINTS_KEY = 'focusOrb:hints';
const HINT_MS = 8000;

export type HintId = 'chrome' | 'leave-tab' | 'fullscreen' | 'click' | 'hover';

function loadSeen(): Record<string, boolean> {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(HINTS_KEY);
    return raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

function saveSeen(seen: Record<string, boolean>) {
  localStorage.setItem(HINTS_KEY, JSON.stringify(seen));
}

interface HintsProps {
  active: boolean;
  chromeVisible: boolean;
  revision?: number;
  banner?: { id: HintId; text: string } | null;
  teach?: boolean;
}

export function Hints({
  active,
  chromeVisible,
  revision = 0,
  banner = null,
  teach = false,
}: HintsProps) {
  const [seen, setSeen] = useState<Record<string, boolean>>({});
  const [ready, setReady] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    setSeen(loadSeen());
    setReady(true);
  }, [revision]);

  const next = teach && banner && !seen[banner.id] ? banner : null;

  useEffect(() => {
    if (!active || !ready || !next || helpOpen) return;
    const timeout = window.setTimeout(() => dismiss(next.id), HINT_MS);
    return () => window.clearTimeout(timeout);
  }, [active, ready, next, helpOpen]);

  const dismiss = (id: HintId) => {
    setSeen((current) => {
      const nextSeen = { ...current, [id]: true };
      saveSeen(nextSeen);
      return nextSeen;
    });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === '?') {
        e.preventDefault();
        setHelpOpen((open) => !open);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!active) return null;

  return (
    <>
      <button
        type="button"
        data-testid="help-toggle"
        onClick={() => setHelpOpen((open) => !open)}
        className={`help-toggle fixed top-4 left-4 z-40 flex h-6 w-6 items-center justify-center p-0 text-[length:var(--type-chrome)] leading-none text-orb-quiet transition-opacity duration-300 hover:text-orb-dim ${
          chromeVisible
            ? 'visible opacity-100'
            : 'invisible pointer-events-none opacity-0'
        }`}
        aria-label={SHORTCUTS_LABEL}
      >
        ?
      </button>

      {helpOpen ? (
        <div
          data-testid="short-help"
          data-text-clear
          className="fixed top-14 left-4 z-40 max-w-xs space-y-2 text-[length:var(--type-hint)] leading-5 text-orb-dim"
        >
          {SHORTCUT_ROWS.map((row) => (
            <div key={row.key} className="flex items-center gap-2">
              <KeyHint label={row.key} />
              <span>{row.action}</span>
            </div>
          ))}
        </div>
      ) : next && ready && (chromeVisible || Boolean(next)) ? (
        <div
          data-testid="hint"
          data-text-clear
          className="fixed top-14 left-4 z-40 text-[length:var(--type-hint)] leading-5 text-orb-quiet"
        >
          {next.text}
        </div>
      ) : null}
    </>
  );
}

export function markHintSeen(id: HintId) {
  const seen = loadSeen();
  if (seen[id]) return;
  seen[id] = true;
  saveSeen(seen);
}
