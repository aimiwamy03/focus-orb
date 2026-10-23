'use client';

import { useEffect, useState } from 'react';
import { signInWithGoogleCalendar } from '@/app/actions';
import { LegalLinks } from './LegalLinks';
import { SHOW_AGENDA_LABEL } from '@/lib/agenda';
import { CalendarInfo, calendarLabelTags } from '@/lib/calendars';
import {
  CUSTOM_DURATION_LABEL,
  DURATION_CHIPS,
  DurationChoice,
  canStartCustom,
  customDurationError,
  isCustomDuration,
  isPresetDuration,
  saveLastDuration,
} from '@/lib/focusPrompt';
import {
  DEFAULT_DURATION_LABEL,
  SIGN_OUT_LABEL,
  WARN_BEFORE_MEETINGS_LABEL,
} from '@/lib/miniOrb';
import { isGoogleConfigured } from '@/lib/onboarding';
import {
  CLEAR_LABEL,
  CLEAR_LOG_LABEL,
  CLEAR_LOG_PROMPT,
  KEEP_LOG_LABEL,
} from '@/lib/focusLog';
import { SHOW_BACKDROP_LABEL } from '@/lib/backdrop';
import { INTRO_SOUND_LABEL } from '@/lib/intro';
import type { WhoopConnectionStatus, WhoopMode } from '@/lib/whoop';
import { WhoopSettings } from './WhoopSettings';

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
  onClearLog?: () => void;
  introSound?: boolean;
  setIntroSound?: (value: boolean) => void;
  showBackdrop?: boolean;
  setShowBackdrop?: (value: boolean) => void;
  whoopConnected?: boolean;
  whoopStatus?: WhoopConnectionStatus;
  whoopMode?: WhoopMode;
  setWhoopMode?: (mode: WhoopMode) => void;
  whoopShowNumbers?: boolean;
  setWhoopShowNumbers?: (value: boolean) => void;
  onWhoopConnect?: () => void;
  onWhoopDisconnect?: () => void;
  whoopMessage?: string | null;
}

function TextSwitch({
  testId,
  label,
  checked,
  onChange,
}: {
  testId: string;
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      data-testid={testId}
      data-selected={checked ? 'true' : 'false'}
      onClick={() => onChange(!checked)}
      className="settings-toggle"
    >
      {label}
    </button>
  );
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
  onClearLog,
  introSound = true,
  setIntroSound,
  showBackdrop = true,
  setShowBackdrop,
  whoopConnected = false,
  whoopStatus = 'disconnected',
  whoopMode = 'suggest',
  setWhoopMode,
  whoopShowNumbers = true,
  setWhoopShowNumbers,
  onWhoopConnect,
  onWhoopDisconnect,
  whoopMessage,
}: SettingsProps) {
  const [tempUrl, setTempUrl] = useState(calendarUrl);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [clearLogConfirm, setClearLogConfirm] = useState(false);
  const [customDraft, setCustomDraft] = useState(
    isCustomDuration(defaultDuration) && typeof defaultDuration === 'number'
      ? String(defaultDuration)
      : ''
  );
  const configured = isGoogleConfigured();
  const customSelected = isCustomDuration(defaultDuration);
  const customError = customSelected ? customDurationError(customDraft) : null;

  useEffect(() => {
    const active = document.activeElement;
    if (active instanceof HTMLElement) active.blur();
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleSave = () => {
    setCalendarUrl(tempUrl);
    selectAuthMethod('ical');
    onClose();
  };

  const handleGoogleConnect = async () => {
    setIsConnecting(true);
    try {
      selectAuthMethod('google');
      await signInWithGoogleCalendar();
    } catch (error) {
      console.error('Failed to connect:', error);
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    await disconnectGoogle();
  };

  const pickDuration = (choice: DurationChoice) => {
    setDefaultDuration(choice);
    if (choice !== 'custom') saveLastDuration(choice);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4">
      <div
        data-testid="settings-sheet"
        className="settings-sheet flex max-h-[min(90vh,calc(100dvh-2rem))] min-h-0 w-full max-w-md cursor-auto flex-col"
      >
        <div className="flex shrink-0 items-center justify-between px-6 pb-4 pt-6">
          <h2 className="settings-heading">Settings</h2>
          <button
            onClick={onClose}
            className="settings-link text-orb-quiet hover:text-orb-text"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div
          data-testid="settings-body"
          className="settings-body min-h-0 flex-1 space-y-6 overflow-y-auto px-6 pb-6"
        >
        <div className="space-y-2">
          <label className="settings-label">Calendars</label>
          {isGoogleConnected ? (
            <div className="space-y-3">
              <div className="settings-copy">{userEmail || 'Connected'}</div>
              {calendars.length > 0 ? (
                <div data-testid="calendar-picker" className="space-y-2">
                  {calendars.map((calendar) => {
                    const selected = selectedCalendarIds.includes(calendar.id);
                    return (
                      <button
                        key={calendar.id}
                        type="button"
                        role="switch"
                        aria-checked={selected}
                        onClick={() => toggleCalendar(calendar.id)}
                        data-selected={selected ? 'true' : 'false'}
                        className="settings-toggle flex w-full items-center justify-between text-left"
                      >
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
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
          ) : configured ? (
            <button
              onClick={handleGoogleConnect}
              disabled={isConnecting}
              className="settings-action underline decoration-1 underline-offset-4"
            >
              {isConnecting ? 'Connecting...' : 'Connect Google Calendar'}
            </button>
          ) : (
            <p
              data-testid="calendar-unconfigured"
              className="settings-copy text-[18px] leading-snug text-orb-text"
            >
              Google Calendar is not configured. Try a sample day from the first screen.
            </p>
          )}
          {!isGoogleConnected ? (
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                data-testid="ical-toggle"
                className="settings-link text-[18px] leading-snug text-orb-text underline decoration-1 underline-offset-4"
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
                    className="w-full border-0 border-b border-white/30 bg-transparent px-0 py-2 text-[length:var(--type-log-body)] text-orb-text placeholder:text-orb-placeholder focus:border-white focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleSave}
                    className="settings-action underline decoration-1 underline-offset-4"
                  >
                    Save iCal URL
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        {setWhoopMode && setWhoopShowNumbers && onWhoopConnect && onWhoopDisconnect ? (
          <WhoopSettings
            connected={whoopConnected}
            status={whoopStatus}
            mode={whoopMode}
            setMode={setWhoopMode}
            showNumbers={whoopShowNumbers}
            setShowNumbers={setWhoopShowNumbers}
            onConnect={onWhoopConnect}
            onDisconnect={onWhoopDisconnect}
            message={whoopMessage}
          />
        ) : null}

        <div className="space-y-2">
          <label className="settings-label">{DEFAULT_DURATION_LABEL}</label>
          <div className="flex flex-wrap items-center gap-3">
            {DURATION_CHIPS.map((minutes) => (
              <button
                key={minutes}
                type="button"
                data-testid={`default-duration-${minutes}`}
                data-selected={isPresetDuration(defaultDuration) && defaultDuration === minutes ? 'true' : 'false'}
                onClick={() => pickDuration(minutes)}
                className="settings-chip"
              >
                {minutes}m
              </button>
            ))}
            <button
              type="button"
              data-testid="default-duration-custom"
              data-selected={customSelected ? 'true' : 'false'}
              onClick={() => pickDuration(customDraft ? Number(customDraft) || 'custom' : 'custom')}
              className="settings-chip"
            >
              {CUSTOM_DURATION_LABEL}
            </button>
          </div>
          {customSelected ? (
            <div className="flex flex-col items-start gap-2">
              <input
                data-testid="default-custom-minutes"
                className="custom-minutes"
                inputMode="numeric"
                pattern="[0-9]*"
                value={customDraft}
                onChange={(event) => {
                  const next = event.target.value.replace(/\D/g, '');
                  setCustomDraft(next);
                  const parsed = canStartCustom(next);
                  if (parsed.ok) {
                    setDefaultDuration(parsed.minutes);
                    saveLastDuration(parsed.minutes);
                  } else {
                    setDefaultDuration('custom');
                  }
                }}
              />
              {customError ? (
                <p data-testid="default-custom-error" className="custom-minutes-error">
                  {customError}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="space-y-2">
          <label className="settings-label">{WARN_BEFORE_MEETINGS_LABEL}</label>
          <div className="flex flex-wrap items-center gap-3">
            {[15, 30, 60, 90].map((minutes) => (
              <button
                key={minutes}
                type="button"
                data-selected={scatterWindow === minutes ? 'true' : 'false'}
                onClick={() => setScatterWindow(minutes)}
                className="settings-chip"
              >
                {minutes}m
              </button>
            ))}
          </div>
        </div>

        {setShowAgenda || setShowBackdrop ? (
          <div className="flex flex-col items-start gap-3">
            {setShowAgenda ? (
              <TextSwitch
                testId="show-agenda"
                label={SHOW_AGENDA_LABEL}
                checked={showAgenda}
                onChange={setShowAgenda}
              />
            ) : null}
            {setShowBackdrop ? (
              <TextSwitch
                testId="show-backdrop"
                label={SHOW_BACKDROP_LABEL}
                checked={showBackdrop}
                onChange={setShowBackdrop}
              />
            ) : null}
          </div>
        ) : null}

        {pipSupported && setPopOutOnLeave ? (
          <div className="space-y-2">
            <p className="settings-label">Mini orb</p>
            <TextSwitch
              testId="pop-out-on-leave"
              label="Pop out when I leave this tab"
              checked={popOutOnLeave}
              onChange={setPopOutOnLeave}
            />
          </div>
        ) : null}

        {setIntroSound ? (
          <TextSwitch
            testId="intro-sound"
            label={INTRO_SOUND_LABEL}
            checked={introSound}
            onChange={setIntroSound}
          />
        ) : null}

        {onClearLog ? (
          <div className="space-y-2">
            {clearLogConfirm ? (
              <div data-testid="clear-log-confirm" className="space-y-2">
                <p className="settings-copy">{CLEAR_LOG_PROMPT}</p>
                <div className="flex gap-4">
                  <button
                    type="button"
                    data-testid="clear-log-keep"
                    onClick={() => setClearLogConfirm(false)}
                    className="settings-action underline decoration-1 underline-offset-4"
                  >
                    {KEEP_LOG_LABEL}
                  </button>
                  <button
                    type="button"
                    data-testid="clear-log-yes"
                    onClick={() => {
                      onClearLog();
                      setClearLogConfirm(false);
                    }}
                    className="settings-action underline decoration-1 underline-offset-4"
                  >
                    {CLEAR_LABEL}
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                data-testid="clear-log"
                onClick={() => setClearLogConfirm(true)}
                className="settings-action underline decoration-1 underline-offset-4"
              >
                {CLEAR_LOG_LABEL}
              </button>
            )}
          </div>
        ) : null}

        {userEmail || isGoogleConnected ? (
          <div className="space-y-2 border-t border-white/10 pt-4">
            {userEmail ? (
              <p data-testid="signed-in-email" className="settings-copy">
                {userEmail}
              </p>
            ) : null}
            <button
              type="button"
              data-testid="sign-out"
              onClick={handleDisconnect}
              className="settings-action underline decoration-1 underline-offset-4"
            >
              {SIGN_OUT_LABEL}
            </button>
          </div>
        ) : null}
        <div className="border-t border-white/10 pt-4">
          <LegalLinks testId="settings-legal" />
        </div>
        </div>
      </div>
    </div>
  );
}
