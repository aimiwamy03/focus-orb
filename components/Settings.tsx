'use client';

import { useState } from 'react';
import { signInWithGoogle } from '@/app/actions';
import { SHOW_AGENDA_LABEL } from '@/lib/agenda';
import { CalendarInfo, calendarLabelTags } from '@/lib/calendars';
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
  showAgenda?: boolean;
  setShowAgenda?: (value: boolean) => void;
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
  showAgenda = true,
  setShowAgenda,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4">
      <div
        data-testid="settings-sheet"
        className="flex max-h-[min(90vh,calc(100dvh-2rem))] min-h-0 w-full max-w-md flex-col rounded-lg"
        style={{ backgroundColor: SETTINGS_BG }}
      >
        <div className="flex shrink-0 items-center justify-between px-6 pb-4 pt-6">
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

        <div
          data-testid="settings-body"
          className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 pb-6"
        >
        <div className="space-y-2">
          <label className="text-[length:var(--type-status)] font-medium text-orb-dim">
            Calendars
          </label>
          {isGoogleConnected ? (
            <div className="space-y-3">
              <div className="rounded bg-black/30 px-3 py-2 text-[length:var(--type-status)] text-orb-text">
                {userEmail || 'Connected'}
              </div>
              {calendars.length > 0 ? (
                <div data-testid="calendar-picker" className="space-y-2">
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
                        {calendarLabelTags(calendar).map((tag) => (
                          <span
                            key={tag}
                            data-testid={`calendar-tag-${tag}`}
                            className="text-orb-muted"
                          >
                            {' '}({tag})
                          </span>
                        ))}
                      </span>
                    </label>
                  ))}
                </div>
              ) : null}
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
            <p className="text-[length:var(--type-hint)] text-orb-quiet">
              Google Calendar is not configured. Try a sample day from the first screen.
            </p>
          )}
          {!isGoogleConnected ? (
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="text-[length:var(--type-hint)] text-orb-quiet transition-colors hover:text-orb-dim"
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
                    className="w-full rounded border border-white/10 bg-black/30 px-3 py-2 text-[length:var(--type-status)] text-orb-text placeholder:text-orb-placeholder focus:outline-none focus:ring-2 focus:ring-white/20"
                  />
                  <button
                    type="button"
                    onClick={handleSave}
                    className="w-full rounded bg-black/40 px-4 py-2 text-[length:var(--type-status)] text-orb-text transition-colors hover:bg-black/20"
                  >
                    Save iCal URL
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="space-y-2">
          <label className="text-[length:var(--type-status)] font-medium text-orb-dim">
            {DEFAULT_DURATION_LABEL}
          </label>
          <div className="flex gap-2">
            {DURATION_CHIPS.map((minutes) => (
              <button
                key={minutes}
                type="button"
                data-testid={`default-duration-${minutes}`}
                onClick={() => {
                  setDefaultDuration(minutes);
                  saveLastDuration(minutes);
                }}
                className={`flex-1 rounded px-3 py-2 text-[length:var(--type-chip)] transition-colors ${
                  defaultDuration === minutes
                    ? 'bg-white text-black'
                    : 'bg-black/30 text-orb-text hover:bg-black/20'
                }`}
              >
                {minutes}m
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[length:var(--type-status)] font-medium text-orb-dim">
            {WARN_BEFORE_MEETINGS_LABEL}
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

        {setShowAgenda ? (
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-[length:var(--type-status)] text-orb-dim">
              <input
                type="checkbox"
                data-testid="show-agenda"
                checked={showAgenda}
                onChange={(event) => setShowAgenda(event.target.checked)}
                className="rounded border-orb-quiet bg-black/30"
              />
              {SHOW_AGENDA_LABEL}
            </label>
          </div>
        ) : null}

        {pipSupported && setPopOutOnLeave ? (
          <div className="space-y-2">
            <p className="text-[length:var(--type-status)] font-medium text-orb-dim">Mini orb</p>
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

        {isGoogleConnected ? (
          <div className="space-y-2 border-t border-white/10 pt-4">
            {userEmail ? (
              <p data-testid="signed-in-email" className="text-[length:var(--type-status)] text-orb-dim">
                {userEmail}
              </p>
            ) : null}
            <button
              type="button"
              data-testid="sign-out"
              onClick={handleDisconnect}
              className="w-full rounded bg-black/30 px-3 py-2 text-[length:var(--type-status)] text-orb-text transition-colors hover:bg-black/20"
            >
              {SIGN_OUT_LABEL}
            </button>
          </div>
        ) : null}
        </div>
      </div>
    </div>
  );
}
