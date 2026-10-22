import { describe, it, expect, vi } from 'vitest';
import {
  defaultSelectedCalendarIds,
  fetchGoogleCalendarList,
  fetchMergedGoogleEvents,
  mergeEventsFromCalendars,
  calendarLabelTags,
  MOCK_GOOGLE_CALENDARS,
  parseGoogleCalendarList,
  parseGoogleEvents,
  resolveSelectedCalendarIds,
  sameCalendarIds,
} from './calendars';

const personalEvent = {
  summary: 'Lunch',
  start: { dateTime: '2026-10-09T12:00:00' },
  end: { dateTime: '2026-10-09T12:30:00' },
};

const workEvent = {
  summary: 'Sprint planning',
  start: { dateTime: '2026-10-09T15:00:00' },
  end: { dateTime: '2026-10-09T16:00:00' },
};

const calendarListPayload = {
  items: [
    { id: 'primary', summary: 'Personal', primary: true },
    { id: 'work@company.com', summary: 'Work' },
  ],
};

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

describe("Amy's calendar list", () => {
  const amyList = {
    items: [
      {
        id: 'events-reminders@google.com',
        summary: 'Events/Reminders',
        primary: true,
        accessRole: 'owner',
      },
      {
        id: 'abc123@group.calendar.google.com',
        summary: 'Self',
        accessRole: 'owner',
      },
      {
        id: 'xyz789@import.calendar.google.com',
        summary: 'Self',
        accessRole: 'reader',
      },
      {
        id: 'en.usa#holiday@group.v.calendar.google.com',
        summary: 'Holidays in United States',
        accessRole: 'reader',
      },
      { id: 'work@company.com', summary: 'Work', accessRole: 'owner' },
      {
        id: 'remind-event@group.calendar.google.com',
        summary: 'Remind/Event',
        accessRole: 'owner',
      },
    ],
  };

  it('tags only the Google primary calendar, plus imported and holidays', () => {
    const calendars = parseGoogleCalendarList(amyList);
    expect(calendars.map((calendar) => calendar.summary)).toEqual([
      'Events/Reminders',
      'Self',
      'Self',
      'Holidays in United States',
      'Work',
      'Remind/Event',
    ]);
    expect(calendars.filter((calendar) => calendar.primary)).toHaveLength(1);
    expect(calendarLabelTags(calendars[0])).toEqual(['primary']);
    expect(calendarLabelTags(calendars[1])).toEqual([]);
    expect(calendarLabelTags(calendars[2])).toEqual(['imported']);
    expect(calendarLabelTags(calendars[3])).toEqual(['holidays']);
    expect(calendarLabelTags(calendars[4])).toEqual([]);
    expect(calendarLabelTags(calendars[5])).toEqual([]);
    expect(defaultSelectedCalendarIds(calendars)).toEqual([
      'events-reminders@google.com',
      'abc123@group.calendar.google.com',
      'xyz789@import.calendar.google.com',
      'work@company.com',
      'remind-event@group.calendar.google.com',
    ]);
    expect(defaultSelectedCalendarIds(calendars)).not.toContain(
      'en.usa#holiday@group.v.calendar.google.com'
    );
  });

  it('does not mark an owned Self calendar as primary in the mock fixture', () => {
    const tagged = MOCK_GOOGLE_CALENDARS.filter((calendar) =>
      calendarLabelTags(calendar).includes('primary')
    );
    expect(tagged.map((calendar) => calendar.summary)).toEqual(['Events/Reminders']);
    const self = MOCK_GOOGLE_CALENDARS.filter((calendar) => calendar.summary === 'Self');
    expect(self).toHaveLength(2);
    expect(self.some((calendar) => calendar.primary)).toBe(false);
  });
});

describe('parseGoogleCalendarList / parseGoogleEvents', () => {
  it('maps mocked Google list and event payloads', () => {
    const calendars = parseGoogleCalendarList(calendarListPayload);
    expect(calendars).toEqual([
      { id: 'primary', summary: 'Personal', primary: true },
      { id: 'work@company.com', summary: 'Work', primary: false },
    ]);
    expect(defaultSelectedCalendarIds(calendars)).toEqual(['primary', 'work@company.com']);

    const personal = parseGoogleEvents({ items: [personalEvent] });
    expect(personal[0].summary).toBe('Lunch');
    expect(personal[0].isAllDay).toBe(false);
  });
});

describe('mergeEventsFromCalendars', () => {
  it('drops events from an unchecked calendar', () => {
    const eventsById = {
      primary: parseGoogleEvents({ items: [personalEvent] }),
      'work@company.com': parseGoogleEvents({ items: [workEvent] }),
    };

    const both = mergeEventsFromCalendars(eventsById, ['primary', 'work@company.com']);
    expect(both.map((event) => event.summary)).toEqual(['Lunch', 'Sprint planning']);

    const onlyPrimary = mergeEventsFromCalendars(eventsById, ['primary']);
    expect(onlyPrimary.map((event) => event.summary)).toEqual(['Lunch']);
  });
});

describe('mocked Google API', () => {
  it('lists two calendars and merges only the selected ones', async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.includes('/users/me/calendarList')) {
        return jsonResponse(calendarListPayload);
      }
      if (url.includes('/calendars/primary/events')) {
        return jsonResponse({ items: [personalEvent] });
      }
      if (url.includes('/calendars/work%40company.com/events')) {
        return jsonResponse({ items: [workEvent] });
      }
      return jsonResponse({ error: 'unexpected' }, 404);
    });

    const calendars = await fetchGoogleCalendarList('mock-token', fetchImpl);
    expect(calendars.map((calendar) => calendar.summary)).toEqual(['Personal', 'Work']);

    const range = {
      timeMin: '2026-10-09T00:00:00.000Z',
      timeMax: '2026-10-09T23:59:59.999Z',
    };

    const both = await fetchMergedGoogleEvents(
      'mock-token',
      ['primary', 'work@company.com'],
      range,
      fetchImpl
    );
    expect(both.map((event) => event.summary)).toEqual(['Lunch', 'Sprint planning']);

    const onlyPrimary = await fetchMergedGoogleEvents('mock-token', ['primary'], range, fetchImpl);
    expect(onlyPrimary.map((event) => event.summary)).toEqual(['Lunch']);
    expect(onlyPrimary.some((event) => event.summary === 'Sprint planning')).toBe(false);
  });

  it('keeps events from other calendars when an imported reader calendar fails', async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.includes('/calendars/primary/events')) {
        return jsonResponse({ items: [personalEvent] });
      }
      if (url.includes('import.calendar.google.com')) {
        return jsonResponse({ error: 'forbidden' }, 403);
      }
      return jsonResponse({ error: 'unexpected' }, 404);
    });
    const events = await fetchMergedGoogleEvents(
      'mock-token',
      ['primary', 'xyz789@import.calendar.google.com'],
      {
        timeMin: '2026-10-09T00:00:00.000Z',
        timeMax: '2026-10-09T23:59:59.999Z',
      },
      fetchImpl
    );
    expect(events.map((event) => event.summary)).toEqual(['Lunch']);
  });
});

describe('resolveSelectedCalendarIds', () => {
  const calendars = parseGoogleCalendarList(calendarListPayload);

  it('defaults to every non-holiday calendar, imported included', () => {
    expect(resolveSelectedCalendarIds(calendars, null)).toEqual(['primary', 'work@company.com']);
  });

  it('keeps a stored selection that still exists', () => {
    expect(resolveSelectedCalendarIds(calendars, ['work@company.com'])).toEqual([
      'work@company.com',
    ]);
  });

  it('treats the same id list as unchanged so a poll cannot retrigger fetch', () => {
    const first = resolveSelectedCalendarIds(calendars, ['primary']);
    const second = resolveSelectedCalendarIds(calendars, ['primary']);
    expect(first).not.toBe(second);
    expect(sameCalendarIds(first, second)).toBe(true);
    expect(sameCalendarIds(first, ['work@company.com'])).toBe(false);
  });
});
