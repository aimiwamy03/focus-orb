import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/app/actions', () => ({ signInWithGoogle: vi.fn() }));

import { Settings } from './Settings';
import { MOCK_GOOGLE_CALENDARS, calendarLabelTags } from '@/lib/calendars';
import { SIGN_OUT_LABEL } from '@/lib/miniOrb';

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
  });
});
