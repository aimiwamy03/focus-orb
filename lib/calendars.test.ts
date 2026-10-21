import { describe, it, expect, vi } from 'vitest';
import {
  defaultSelectedCalendarIds,
  fetchGoogleCalendarList,
  fetchMergedGoogleEvents,
  mergeEventsFromCalendars,
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

describe('parseGoogleCalendarList / parseGoogleEvents', () => {
  it('maps mocked Google list and event payloads', () => {
    const calendars = parseGoogleCalendarList(calendarListPayload);
    expect(calendars).toEqual([
      { id: 'primary', summary: 'Personal', primary: true },
      { id: 'work@company.com', summary: 'Work', primary: false },
    ]);
    expect(defaultSelectedCalendarIds(calendars)).toEqual(['primary']);

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
});

describe('resolveSelectedCalendarIds', () => {
  const calendars = parseGoogleCalendarList(calendarListPayload);

  it('defaults to the primary calendar', () => {
    expect(resolveSelectedCalendarIds(calendars, null)).toEqual(['primary']);
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
