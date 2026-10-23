'use client';

import { useEffect, useMemo, useState } from 'react';
import { KeyHint } from './KeyHint';
import {
  WHOOP_CONSENT_CHECK,
  WHOOP_CONSENT_COPY,
  WHOOP_CONNECT_LABEL,
  WHOOP_DEVICES_NOTE,
  WHOOP_DISCONNECT_LABEL,
  WHOOP_MODE_HINTS,
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
  message,
}: {
  connected: boolean;
  status: WhoopConnectionStatus;
  mode: WhoopMode;
  setMode: (mode: WhoopMode) => void;
  showNumbers: boolean;
  setShowNumbers: (value: boolean) => void;
  onConnect: () => void;
  onDisconnect: () => void;
  message?: string | null;
}) {
  const rows = useMemo<Row[]>(
    () => (connected ? ['connection', 'mode', 'numbers'] : ['connection']),
    [connected]
  );
  const [index, setIndex] = useState(0);
  const [consented, setConsented] = useState(false);
  const rowIndex = Math.min(index, rows.length - 1);
  const statusLabel = whoopSettingsStatus(status);
  const connectLabel = connected
    ? WHOOP_DISCONNECT_LABEL
    : status === 'reconnect'
      ? WHOOP_RECONNECT_LABEL
      : WHOOP_CONNECT_LABEL;
  const canConnect = connected || consented;

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
          else if (canConnect) onConnect();
          return;
        }
        if (row === 'numbers') setShowNumbers(!showNumbers);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [canConnect, connected, index, mode, onConnect, onDisconnect, rows, setMode, setShowNumbers, showNumbers]);

  return (
    <div data-testid="whoop-settings" className="space-y-3">
      <label className="text-[length:var(--type-whoop)] font-medium text-orb-text">
        {WHOOP_SECTION_LABEL}
      </label>
      {statusLabel ? (
        <p data-testid="whoop-status" className="text-[length:var(--type-whoop)] text-orb-text">
          {statusLabel}
        </p>
      ) : null}
      {message ? (
        <p data-testid="whoop-message" className="text-[length:var(--type-whoop)] text-orb-text">
          {message}
        </p>
      ) : null}

      {!connected ? (
        <div data-testid="whoop-consent" className="space-y-3">
          <p className="text-[length:var(--type-whoop)] leading-snug text-orb-text">
            {WHOOP_CONSENT_COPY}
          </p>
          <label className="flex items-start gap-3 text-[length:var(--type-whoop)] text-orb-text">
            <input
              type="checkbox"
              data-testid="whoop-consent-check"
              checked={consented}
              onChange={(event) => setConsented(event.target.checked)}
              className="mt-1 border-orb-quiet bg-black/30"
            />
            <span>{WHOOP_CONSENT_CHECK}</span>
          </label>
        </div>
      ) : null}

      <button
        type="button"
        data-testid="whoop-connect"
        data-highlighted={rowIndex === 0 ? 'true' : 'false'}
        onClick={() => (connected ? onDisconnect() : canConnect ? onConnect() : undefined)}
        disabled={!canConnect}
        className={`flex w-full items-center justify-between rounded px-3 py-2 text-[length:var(--type-whoop)] ${
          canConnect
            ? 'bg-black/30 text-orb-text'
            : 'cursor-not-allowed bg-transparent text-orb-quiet ring-1 ring-white/20'
        }`}
      >
        <span>{connectLabel}</span>
        <span className="inline-flex items-center gap-1 text-orb-quiet">
          <KeyHint label="Enter" />
        </span>
      </button>

      <p data-testid="whoop-devices" className="text-[length:var(--type-whoop)] text-orb-dim">
        {WHOOP_DEVICES_NOTE}
      </p>

      {connected ? (
        <>
          <div className="space-y-1">
            <div
              data-testid="whoop-mode"
              data-highlighted={rows[rowIndex] === 'mode' ? 'true' : 'false'}
              className="flex items-center justify-between rounded bg-black/30 px-3 py-2 text-[length:var(--type-whoop)] text-orb-text"
            >
              <span>Mode</span>
              <span className="inline-flex items-center gap-1.5 text-orb-quiet">
                <button
                  type="button"
                  aria-label="Previous mode"
                  data-testid="whoop-mode-prev"
                  onClick={() => setMode(cycleWhoopMode(mode, -1))}
                  className="px-1 text-orb-quiet"
                >
                  ‹
                </button>
                <span data-testid="whoop-mode-value" className="text-orb-text">
                  {WHOOP_MODE_LABELS[mode]}
                </span>
                <button
                  type="button"
                  aria-label="Next mode"
                  data-testid="whoop-mode-next"
                  onClick={() => setMode(cycleWhoopMode(mode, 1))}
                  className="px-1 text-orb-quiet"
                >
                  ›
                </button>
              </span>
            </div>
            <p
              data-testid="whoop-mode-hint"
              className="px-1 text-[length:var(--type-whoop)] leading-snug text-orb-quiet"
            >
              {WHOOP_MODE_HINTS[mode]}
            </p>
          </div>
          <label
            data-testid="whoop-show-numbers"
            data-highlighted={rows[rowIndex] === 'numbers' ? 'true' : 'false'}
            className="flex items-center justify-between rounded bg-black/30 px-3 py-2 text-[length:var(--type-whoop)] text-orb-dim"
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
