import { afterEach, describe, it, expect, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

vi.mock('@/app/actions', () => ({ signInWithGoogle: vi.fn() }));

import { Settings } from './Settings';
import { MOCK_GOOGLE_CALENDARS, calendarLabelTags } from '@/lib/calendars';
import { SIGN_OUT_LABEL } from '@/lib/miniOrb';

afterEach(() => cleanup());

function renderSettings() {
  return render(
    <Settings
      onClose={() => {}}
      calendarUrl=""
      setCalendarUrl={() => {}}
      scatterWindow={15}
      setScatterWindow={() => {}}
      authMethod="google"
      selectAuthMethod={() => {}}
      isGoogleConnected
      disconnectGoogle={async () => {}}
      calendars={MOCK_GOOGLE_CALENDARS}
      selectedCalendarIds={['primary']}
      toggleCalendar={() => {}}
      defaultDuration={50}
      setDefaultDuration={() => {}}
      onClearLog={vi.fn()}
    />
  );
}

describe('Settings sheet', () => {
  it('keeps one primary tag, imported and holidays, and a scrollable sign-out row', () => {
    renderSettings();
    const primary = MOCK_GOOGLE_CALENDARS.filter((calendar) =>
      calendarLabelTags(calendar).includes('primary')
    );
    expect(primary).toHaveLength(1);
    expect(screen.getAllByTestId('calendar-tag-primary')).toHaveLength(1);
    expect(screen.getByTestId('calendar-tag-imported').textContent).toContain('imported');
    expect(screen.getByTestId('calendar-tag-holidays').textContent).toContain('holidays');
    expect(screen.getByTestId('calendar-tag-primary').textContent).toContain('primary');
    expect(screen.queryByText(/Personal/)).toBeNull();
    expect(screen.getByText(/Events\/Reminders/)).toBeTruthy();
    expect(screen.getByText(/Remind\/Event/)).toBeTruthy();

    const body = screen.getByTestId('settings-body');
    expect(body.className).toContain('overflow-y-auto');
    expect(body.contains(screen.getByTestId('sign-out'))).toBe(true);
    expect(screen.getByTestId('sign-out').textContent).toBe(SIGN_OUT_LABEL);
    expect(screen.getByLabelText('Close')).toBeTruthy();
    expect(screen.getByTestId('settings-sheet').className).toContain('max-h-');
    expect(screen.getByTestId('clear-log').textContent).toBe('Clear log');
  });

  it('toggles Play intro and Intro sound', () => {
    const setPlayIntro = vi.fn();
    const setIntroSound = vi.fn();
    render(
      <Settings
        onClose={() => {}}
        calendarUrl=""
        setCalendarUrl={() => {}}
        scatterWindow={15}
        setScatterWindow={() => {}}
        authMethod="google"
        selectAuthMethod={() => {}}
        isGoogleConnected
        disconnectGoogle={async () => {}}
        calendars={MOCK_GOOGLE_CALENDARS}
        selectedCalendarIds={['primary']}
        toggleCalendar={() => {}}
        defaultDuration={50}
        setDefaultDuration={() => {}}
        playIntro
        setPlayIntro={setPlayIntro}
        introSound={false}
        setIntroSound={setIntroSound}
      />
    );
    expect(screen.getByTestId('play-intro')).toBeTruthy();
    expect(screen.getByTestId('intro-sound')).toBeTruthy();
    expect(screen.getByText('Play intro')).toBeTruthy();
    expect(screen.getByText('Intro sound')).toBeTruthy();
    fireEvent.click(screen.getByTestId('play-intro'));
    expect(setPlayIntro).toHaveBeenCalledWith(false);
    fireEvent.click(screen.getByTestId('intro-sound'));
    expect(setIntroSound).toHaveBeenCalledWith(true);
  });

  it('toggles Backdrop and defaults it on', () => {
    const setShowBackdrop = vi.fn();
    render(
      <Settings
        onClose={() => {}}
        calendarUrl=""
        setCalendarUrl={() => {}}
        scatterWindow={15}
        setScatterWindow={() => {}}
        authMethod="google"
        selectAuthMethod={() => {}}
        isGoogleConnected
        disconnectGoogle={async () => {}}
        calendars={MOCK_GOOGLE_CALENDARS}
        selectedCalendarIds={['primary']}
        toggleCalendar={() => {}}
        defaultDuration={50}
        setDefaultDuration={() => {}}
        showBackdrop
        setShowBackdrop={setShowBackdrop}
      />
    );
    const toggle = screen.getByTestId('show-backdrop') as HTMLInputElement;
    expect(toggle.checked).toBe(true);
    expect(screen.getByText('Backdrop')).toBeTruthy();
    fireEvent.click(toggle);
    expect(setShowBackdrop).toHaveBeenCalledWith(false);
  });

  it('asks before clearing the log', () => {
    const onClearLog = vi.fn();
    render(
      <Settings
        onClose={() => {}}
        calendarUrl=""
        setCalendarUrl={() => {}}
        scatterWindow={15}
        setScatterWindow={() => {}}
        authMethod="google"
        selectAuthMethod={() => {}}
        isGoogleConnected
        disconnectGoogle={async () => {}}
        calendars={MOCK_GOOGLE_CALENDARS}
        selectedCalendarIds={['primary']}
        toggleCalendar={() => {}}
        defaultDuration={50}
        setDefaultDuration={() => {}}
        onClearLog={onClearLog}
      />
    );
    fireEvent.click(screen.getByTestId('clear-log'));
    expect(screen.getByTestId('clear-log-confirm').textContent).toContain('Clear the focus log?');
    fireEvent.click(screen.getByTestId('clear-log-keep'));
    expect(onClearLog).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('clear-log'));
    fireEvent.click(screen.getByTestId('clear-log-yes'));
    expect(onClearLog).toHaveBeenCalledTimes(1);
  });

  it('shows a WHOOP section with keys and cycles the mode', () => {
    const setWhoopMode = vi.fn();
    const onWhoopConnect = vi.fn();
    render(
      <Settings
        onClose={() => {}}
        calendarUrl=""
        setCalendarUrl={() => {}}
        scatterWindow={15}
        setScatterWindow={() => {}}
        authMethod="google"
        selectAuthMethod={() => {}}
        isGoogleConnected
        disconnectGoogle={async () => {}}
        calendars={MOCK_GOOGLE_CALENDARS}
        selectedCalendarIds={['primary']}
        toggleCalendar={() => {}}
        defaultDuration={50}
        setDefaultDuration={() => {}}
        whoopConnected
        whoopStatus="ok"
        whoopMode="suggest"
        setWhoopMode={setWhoopMode}
        whoopShowNumbers
        setWhoopShowNumbers={() => {}}
        onWhoopConnect={onWhoopConnect}
        onWhoopDisconnect={() => {}}
      />
    );
    expect(screen.getByTestId('whoop-mode-value').textContent).toBe('Suggest only');
    expect(screen.getByTestId('whoop-mode').textContent).toMatch(/Mode/);
    expect(screen.getByTestId('whoop-mode').textContent).toMatch(/‹/);
    expect(screen.getByTestId('whoop-mode').textContent).toMatch(/›/);
    expect(screen.getByTestId('whoop-mode-hint').textContent).toMatch(/quiet length/i);
    fireEvent.keyDown(window, { key: 'ArrowDown' });
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(setWhoopMode).toHaveBeenCalledWith('adapt');
    screen.getByTestId('whoop-mode-next').click();
    expect(setWhoopMode).toHaveBeenLastCalledWith('adapt');
  });

  it('labels a disconnected WHOOP and reconnects on Enter', () => {
    const onWhoopConnect = vi.fn();
    render(
      <Settings
        onClose={() => {}}
        calendarUrl=""
        setCalendarUrl={() => {}}
        scatterWindow={15}
        setScatterWindow={() => {}}
        authMethod={null}
        selectAuthMethod={() => {}}
        isGoogleConnected={false}
        disconnectGoogle={async () => {}}
        calendars={[]}
        selectedCalendarIds={[]}
        toggleCalendar={() => {}}
        defaultDuration={50}
        setDefaultDuration={() => {}}
        whoopConnected={false}
        whoopStatus="disconnected"
        whoopMode="suggest"
        setWhoopMode={() => {}}
        whoopShowNumbers
        setWhoopShowNumbers={() => {}}
        onWhoopConnect={onWhoopConnect}
        onWhoopDisconnect={() => {}}
      />
    );
    expect(screen.getByTestId('whoop-status').textContent).toBe('WHOOP disconnected');
    expect(screen.getByTestId('whoop-connect').textContent).toContain('Reconnect');
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(onWhoopConnect).toHaveBeenCalledTimes(1);
  });
});
