'use client';

import { useState } from 'react';
import { signInWithGoogle } from '@/app/actions';
import { CalendarInfo } from '@/lib/calendars';
import { DURATION_CHIPS, DurationChoice, saveLastDuration } from '@/lib/focusPrompt';
import {
  DEFAULT_DURATION_LABEL,
  SIGN_OUT_LABEL,
  WARN_BEFORE_MEETINGS_LABEL,
} from '@/lib/miniOrb';
import { isGoogleConfigured } from '@/lib/onboarding';
import { SETTINGS_BG } from '@/lib/palette';

type AuthMethod = 'google' | 'ical' | null;

interface SettingsProps {
  onClose: () => void;
  calendarUrl: string;
  setCalendarUrl: (url: string) => void;
  scatterWindow: number;
  setScatterWindow: (minutes: number) => void;
  authMethod: AuthMethod;
  selectAuthMethod: (method: AuthMethod) => void;
  isGoogleConnected: boolean;
  disconnectGoogle: () => Promise<void>;
  calendars: CalendarInfo[];
  selectedCalendarIds: string[];
  toggleCalendar: (id: string) => void;
  pipSupported?: boolean;
  popOutOnLeave?: boolean;
  setPopOutOnLeave?: (value: boolean) => void;
  defaultDuration: DurationChoice;
  setDefaultDuration: (choice: DurationChoice) => void;
  userEmail?: string | null;
}

export function Settings({
  onClose,
  calendarUrl,
  setCalendarUrl,
  scatterWindow,
  setScatterWindow,
  selectAuthMethod,
  isGoogleConnected,
  disconnectGoogle,
  calendars,
  selectedCalendarIds,
  toggleCalendar,
  pipSupported = false,
  popOutOnLeave = false,
  setPopOutOnLeave,
  defaultDuration,
  setDefaultDuration,
  userEmail,
}: SettingsProps) {
  const [tempUrl, setTempUrl] = useState(calendarUrl);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const configured = isGoogleConfigured();

  const handleSave = () => {
    setCalendarUrl(tempUrl);
    selectAuthMethod('ical');
    onClose();
  };

  const handleGoogleConnect = async () => {
    setIsConnecting(true);
    try {
      selectAuthMethod('google');
      await signInWithGoogle();
    } catch (error) {
      console.error('Failed to connect:', error);
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    await disconnectGoogle();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85">
      <div
        className="mx-4 max-h-[90vh] w-full max-w-md space-y-6 overflow-y-auto rounded-lg p-6"
        style={{ backgroundColor: '#18181b' }}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-[length:var(--type-heading)] font-semibold text-orb-text">
            Settings
          </h2>
          <button
            onClick={onClose}
            className="text-[length:var(--type-chrome)] text-orb-quiet transition-colors hover:text-orb-text"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="space-y-2">
          <label className="text-[length:var(--type-status)] font-medium text-orb-dim">
            Google Calendar
          </label>
          {isGoogleConnected ? (
            <div className="space-y-3">
              <div className="rounded border border-white/10 bg-black/30 px-3 py-2 text-[length:var(--type-status)] text-orb-text">
                ✓ Connected
              </div>
              {calendars.length > 0 ? (
                <div data-testid="calendar-picker" className="space-y-2">
                  <p className="text-[length:var(--type-hint)] text-orb-muted">Calendars</p>
                  {calendars.map((calendar) => (
                    <label
                      key={calendar.id}
                      className="flex items-center gap-2 text-[length:var(--type-status)] text-orb-dim"
                    >
                      <input
                        type="checkbox"
                        checked={selectedCalendarIds.includes(calendar.id)}
                        onChange={() => toggleCalendar(calendar.id)}
                        className="rounded border-orb-quiet bg-black/30"
                      />
                      <span>
                        {calendar.summary}
                        {calendar.primary ? (
                          <span className="text-orb-muted"> (primary)</span>
                        ) : null}
                      </span>
                    </label>
                  ))}
                </div>
              ) : null}
              <button
                onClick={handleDisconnect}
                className="w-full rounded bg-black/30 px-3 py-2 text-[length:var(--type-status)] text-orb-text transition-colors hover:bg-black/20"
              >
                Disconnect
              </button>
            </div>
          ) : configured ? (
            <button
              onClick={handleGoogleConnect}
              disabled={isConnecting}
              className="w-full rounded bg-white px-4 py-2 text-[length:var(--type-button)] font-medium text-black transition-colors hover:bg-orb-dim disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isConnecting ? 'Connecting...' : 'Connect Google Calendar'}
            </button>
          ) : (
            <div className="rounded border border-white/10 bg-black/20 px-3 py-2 text-[length:var(--type-hint)] text-orb-muted">
              Google Calendar integration not configured
            </div>
          )}
          {!isGoogleConnected ? (
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="text-xs text-orb-quiet transition-colors hover:text-orb-dim"
              >
                {showAdvanced ? 'Hide iCal URL' : 'Add iCal URL'}
              </button>
              {showAdvanced ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={tempUrl}
                    onChange={(e) => setTempUrl(e.target.value)}
                    placeholder="Paste secret iCal URL here"
                    className="w-full rounded border border-white/10 bg-black/30 px-3 py-2 text-sm text-orb-text placeholder:text-orb-placeholder focus:outline-none focus:ring-2 focus:ring-white/20"
                  />
                  <button
                    type="button"
                    onClick={handleSave}
                    className="w-full rounded bg-black/40 px-4 py-2 text-sm text-orb-text transition-colors hover:bg-black/20"
                  >
                    Save iCal URL
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* Advanced: iCal URL */}
        {!isGoogleConnected && (
          <div className="space-y-2">
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-[length:var(--type-status)] text-orb-quiet transition-colors hover:text-orb-dim"
            >
              {showAdvanced ? '▼' : '▶'} Other ways to connect
            </button>
            
            {showAdvanced && (
              <div className="space-y-2 pl-4 border-l border-zinc-700">
                <label className="text-[length:var(--type-status)] font-medium text-orb-quiet">
                  iCal URL (Advanced)
                </label>
                <input
                  type="text"
                  value={tempUrl}
                  onChange={(e) => setTempUrl(e.target.value)}
                  placeholder="Paste secret iCal URL here..."
                  className="w-full rounded border border-white/10 bg-black/30 px-3 py-2 text-[length:var(--type-status)] text-orb-text placeholder:text-orb-placeholder focus:outline-none focus:ring-2 focus:ring-white/20"
                />
                <p className="text-[length:var(--type-hint)] text-orb-muted">
                  Find this in Google Calendar → Settings → Integrate calendar → Secret address in iCal format
                </p>
                <button
                  onClick={handleSave}
                  className="w-full rounded bg-black/30 px-4 py-2 text-[length:var(--type-status)] text-orb-text transition-colors hover:bg-black/20"
                >
                  Save iCal URL
                </button>
              </div>
            )}
          </div>
        )}

        {/* Scatter Window */}
        <div className="space-y-2">
          <label className="text-[length:var(--type-status)] font-medium text-orb-dim">
            Scatter window (minutes before meeting)
          </label>
          <div className="flex gap-2">
            {[15, 30, 60, 90].map((minutes) => (
              <button
                key={minutes}
                onClick={() => setScatterWindow(minutes)}
                className={`flex-1 rounded px-3 py-2 text-[length:var(--type-chip)] transition-colors ${
                  scatterWindow === minutes
                    ? 'bg-white text-black'
                    : 'bg-black/30 text-orb-text hover:bg-black/20'
                }`}
              >
                {minutes}m
              </button>
            ))}
          </div>
        </div>

        {pipSupported && setPopOutOnLeave ? (
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-[length:var(--type-status)] text-orb-dim">
              <input
                type="checkbox"
                data-testid="pop-out-on-leave"
                checked={popOutOnLeave}
                onChange={(event) => setPopOutOnLeave(event.target.checked)}
                className="rounded border-orb-quiet bg-black/30"
              />
              Pop out when I leave this tab
            </label>
          </div>
        ) : null}

        {/* Manual Focus */}
        <div className="space-y-2">
          <label className="text-[length:var(--type-status)] font-medium text-orb-dim">
            Start manual focus block
          </label>
          <div className="flex gap-2">
            {[25, 50, 90].map((minutes) => (
              <button
                key={minutes}
                onClick={() => {
                  onStartFocus(minutes);
                  onClose();
                }}
                className="flex-1 rounded bg-black/30 px-3 py-2 text-[length:var(--type-chip)] text-orb-text transition-colors hover:bg-black/20"
              >
                {minutes}m
              </button>
            ))}
          </div>
        </div>

        {/* Keyboard shortcuts */}
        <div className="pt-4 border-t border-zinc-800 space-y-1">
          <p className="text-[length:var(--type-hint)] font-medium text-orb-quiet">
            Keyboard shortcuts
          </p>
          <div className="space-y-1 text-[length:var(--type-hint)] text-orb-muted">
            <div><kbd className="rounded bg-black/30 px-1.5 py-0.5 text-[length:var(--type-key)]">f</kbd> fullscreen</div>
            <div><kbd className="rounded bg-black/30 px-1.5 py-0.5 text-[length:var(--type-key)]">s</kbd> settings</div>
            <div><kbd className="rounded bg-black/30 px-1.5 py-0.5 text-[length:var(--type-key)]">space</kbd> start/stop focus</div>
            {pipSupported ? (
              <div><kbd className="rounded bg-black/30 px-1.5 py-0.5 text-[length:var(--type-key)]">p</kbd> pop out</div>
            ) : null}
            <button
              type="button"
              data-testid="sign-out"
              onClick={handleDisconnect}
              className="w-full rounded bg-black/30 px-3 py-2 text-sm text-orb-text transition-colors hover:bg-black/20"
            >
              {SIGN_OUT_LABEL}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
