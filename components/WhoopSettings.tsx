'use client';

import { useEffect, useMemo, useState } from 'react';
import { KeyHint } from './KeyHint';
import {
  WHOOP_CONNECT_LABEL,
  WHOOP_DISCONNECT_LABEL,
  WHOOP_MODE_LABELS,
  WHOOP_RECONNECT_LABEL,
  WHOOP_SECTION_LABEL,
  WHOOP_SHOW_NUMBERS_LABEL,
  cycleWhoopMode,
  whoopSettingsStatus,
  type WhoopConnectionStatus,
  type WhoopMode,
} from '@/lib/whoop';

type Row = 'connection' | 'mode' | 'numbers';

export function WhoopSettings({
  connected,
  status,
  mode,
  setMode,
  showNumbers,
  setShowNumbers,
  onConnect,
  onDisconnect,
}: {
  connected: boolean;
  status: WhoopConnectionStatus;
  mode: WhoopMode;
  setMode: (mode: WhoopMode) => void;
  showNumbers: boolean;
  setShowNumbers: (value: boolean) => void;
  onConnect: () => void;
  onDisconnect: () => void;
}) {
  const rows = useMemo<Row[]>(
    () => (connected ? ['connection', 'mode', 'numbers'] : ['connection']),
    [connected]
  );
  const [index, setIndex] = useState(0);
  const rowIndex = Math.min(index, rows.length - 1);
  const statusLabel = whoopSettingsStatus(status);
  const connectLabel = connected
    ? WHOOP_DISCONNECT_LABEL
    : status === 'disconnected'
      ? WHOOP_RECONNECT_LABEL
      : WHOOP_CONNECT_LABEL;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return;
      const row = rows[Math.min(index, rows.length - 1)] ?? 'connection';
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        const dir = event.key === 'ArrowDown' ? 1 : -1;
        setIndex((current) => (current + dir + rows.length) % rows.length);
        return;
      }
      if ((event.key === 'ArrowLeft' || event.key === 'ArrowRight') && row === 'mode') {
        event.preventDefault();
        setMode(cycleWhoopMode(mode, event.key === 'ArrowRight' ? 1 : -1));
        return;
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        if (row === 'connection') {
          if (connected) onDisconnect();
          else onConnect();
          return;
        }
        if (row === 'numbers') setShowNumbers(!showNumbers);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [connected, index, mode, onConnect, onDisconnect, rows, setMode, setShowNumbers, showNumbers]);

  return (
    <div data-testid="whoop-settings" className="space-y-3">
      <label className="text-[length:var(--type-status)] font-medium text-orb-dim">
        {WHOOP_SECTION_LABEL}
      </label>
      {statusLabel ? (
        <p data-testid="whoop-status" className="text-[length:var(--type-status)] text-orb-dim">
          {statusLabel}
        </p>
      ) : null}

      <button
        type="button"
        data-testid="whoop-connect"
        data-highlighted={rowIndex === 0 ? 'true' : 'false'}
        onClick={() => (connected ? onDisconnect() : onConnect())}
        className="flex w-full items-center justify-between rounded bg-black/30 px-3 py-2 text-[length:var(--type-status)] text-orb-text"
      >
        <span>{connectLabel}</span>
        <span className="inline-flex items-center gap-1 text-orb-quiet">
          <KeyHint label="Enter" />
        </span>
      </button>

      {connected ? (
        <>
          <div
            data-testid="whoop-mode"
            data-highlighted={rows[rowIndex] === 'mode' ? 'true' : 'false'}
            className="flex items-center justify-between rounded bg-black/30 px-3 py-2 text-[length:var(--type-status)] text-orb-text"
          >
            <span>
              Mode{' '}
              <span data-testid="whoop-mode-value">{WHOOP_MODE_LABELS[mode]}</span>
            </span>
            <span className="inline-flex items-center gap-1 text-orb-quiet">
              <KeyHint label="←" />
              <KeyHint label="→" />
            </span>
          </div>
          <label
            data-testid="whoop-show-numbers"
            data-highlighted={rows[rowIndex] === 'numbers' ? 'true' : 'false'}
            className="flex items-center justify-between rounded bg-black/30 px-3 py-2 text-[length:var(--type-status)] text-orb-dim"
          >
            <span className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={showNumbers}
                onChange={(event) => setShowNumbers(event.target.checked)}
                className="rounded border-orb-quiet bg-black/30"
              />
              {WHOOP_SHOW_NUMBERS_LABEL}
            </span>
            <span className="inline-flex items-center gap-1 text-orb-quiet">
              <KeyHint label="Enter" />
            </span>
          </label>
        </>
      ) : null}
    </div>
  );
}
