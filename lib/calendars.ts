import { CalendarEvent } from './calendar';

export const SELECTED_CALENDARS_KEY = 'focusOrb:selectedCalendars';

export interface CalendarInfo {
  id: string;
  summary: string;
  primary?: boolean;
  backgroundColor?: string;
}

export interface GoogleCalendarListItem {
  id: string;
  summary?: string;
  primary?: boolean;
  accessRole?: string;
  backgroundColor?: string;
}

export const IMPORT_CALENDAR_SUFFIX = '@import.calendar.google.com';
export const HOLIDAY_CALENDAR_SUFFIX = '#holiday@group.v.calendar.google.com';

export function isImportedCalendarId(id: string): boolean {
  return id.endsWith(IMPORT_CALENDAR_SUFFIX);
}

export function isHolidayCalendarId(id: string): boolean {
  return id === HOLIDAY_CALENDAR_SUFFIX || id.endsWith(HOLIDAY_CALENDAR_SUFFIX);
}

export function calendarLabelTags(calendar: Pick<CalendarInfo, 'id' | 'primary'>): string[] {
  const tags: string[] = [];
  if (isImportedCalendarId(calendar.id)) tags.push('imported');
  if (isHolidayCalendarId(calendar.id)) tags.push('holidays');
  if (calendar.primary === true) tags.push('primary');
  return tags;
}

export interface GoogleDateStamp {
  dateTime?: string;
  date?: string;
  timeZone?: string;
}

export interface GoogleEventItem {
  summary?: string;
  start: GoogleDateStamp;
  end: GoogleDateStamp;
  status?: string;
  transparency?: string;
  hangoutLink?: string;
  location?: string;
  description?: string;
  attendees?: { self?: boolean; responseStatus?: string }[];
  conferenceData?: { entryPoints?: { entryPointType?: string; uri?: string }[] };
}

export const AMY_PRIMARY_CALENDAR_ID = 'aimiw.amy03@gmail.com';
export const AMY_SELF_IMPORT_ID =
  '94p2l3gb29u8lvg7ifdvpe2uai2siqmj@import.calendar.google.com';

export function amyImportedWeekNow(): Date {
  return new Date(2026, 9, 21, 15, 0, 0, 0);
}

function localStamp(day: Date, hours: number, minutes = 0): Date {
  const next = new Date(day);
  next.setHours(hours, minutes, 0, 0);
  return next;
}

/** Wed Oct 21 2026: primary has Friday events; imported Self has Thursday. */
export function getAmyImportedWeekByCalendar(
  now: Date = amyImportedWeekNow()
): Record<string, CalendarEvent[]> {
  const thursday = new Date(now);
  thursday.setDate(now.getDate() + 1);
  const friday = new Date(now);
  friday.setDate(now.getDate() + 2);
  return {
    [AMY_PRIMARY_CALENDAR_ID]: [
      {
        summary: 'Friday standup',
        start: localStamp(friday, 10, 0),
        end: localStamp(friday, 10, 30),
        isAllDay: false,
        backgroundColor: '#4285f4',
        calendarId: AMY_PRIMARY_CALENDAR_ID,
      },
      {
        summary: 'Design review',
        start: localStamp(friday, 13, 0),
        end: localStamp(friday, 14, 0),
        isAllDay: false,
        backgroundColor: '#4285f4',
        calendarId: AMY_PRIMARY_CALENDAR_ID,
      },
      {
        summary: 'Team sync',
        start: localStamp(friday, 16, 0),
        end: localStamp(friday, 16, 30),
        isAllDay: false,
        backgroundColor: '#4285f4',
        calendarId: AMY_PRIMARY_CALENDAR_ID,
      },
    ],
    [AMY_SELF_IMPORT_ID]: [
      {
        summary: 'Production Agent Lab - Workshop',
        start: localStamp(thursday, 10, 0),
        end: localStamp(thursday, 20, 0),
        isAllDay: false,
        backgroundColor: '#8e24aa',
        calendarId: AMY_SELF_IMPORT_ID,
      },
      {
        summary: 'Sleep',
        start: localStamp(thursday, 22, 0),
        end: localStamp(thursday, 22, 45),
        isAllDay: false,
        backgroundColor: '#8e24aa',
        calendarId: AMY_SELF_IMPORT_ID,
      },
      {
        summary: 'recap with myself',
        start: localStamp(friday, 20, 0),
        end: localStamp(friday, 21, 0),
        isAllDay: false,
        backgroundColor: '#8e24aa',
        calendarId: AMY_SELF_IMPORT_ID,
      },
    ],
  };
}

export function amyImportedWeekCalendars(): CalendarInfo[] {
  return [
    {
      id: AMY_PRIMARY_CALENDAR_ID,
      summary: 'aimiw.amy03@gmail.com',
      primary: true,
      backgroundColor: '#4285f4',
    },
    {
      id: AMY_SELF_IMPORT_ID,
      summary: 'Self',
      backgroundColor: '#8e24aa',
    },
  ];
}

export const MOCK_GOOGLE_CALENDARS: CalendarInfo[] = [
  {
    id: 'primary',
    summary: 'Events/Reminders',
    primary: true,
    backgroundColor: '#4285f4',
  },
  {
    id: 'amy-self@group.calendar.google.com',
    summary: 'Self',
    backgroundColor: '#33b679',
  },
  {
    id: 'amy-self@import.calendar.google.com',
    summary: 'Self',
    backgroundColor: '#8e24aa',
  },
  {
    id: 'en.usa#holiday@group.v.calendar.google.com',
    summary: 'Holidays in United States',
    backgroundColor: '#f4511e',
  },
  { id: 'work@company.com', summary: 'Work', backgroundColor: '#f6bf26' },
  {
    id: 'remind-event@group.calendar.google.com',
    summary: 'Remind/Event',
    backgroundColor: '#0b8043',
  },
];

export function defaultSelectedCalendarIds(calendars: CalendarInfo[]): string[] {
  const included = calendars.filter((calendar) => !isHolidayCalendarId(calendar.id));
  if (included.length > 0) return included.map((calendar) => calendar.id);
  return calendars[0] ? [calendars[0].id] : [];
}

export function loadSelectedCalendarIds(): string[] | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(SELECTED_CALENDARS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || !parsed.every((id) => typeof id === 'string')) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveSelectedCalendarIds(ids: string[]): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(SELECTED_CALENDARS_KEY, JSON.stringify(ids));
}

export function resolveSelectedCalendarIds(
  calendars: CalendarInfo[],
  stored: string[] | null
): string[] {
  if (stored && stored.length > 0) {
    const valid = stored.filter((id) => calendars.some((calendar) => calendar.id === id));
    if (valid.length > 0) return valid;
  }
  return defaultSelectedCalendarIds(calendars);
}

export function sameCalendarIds(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((id, index) => id === b[index]);
}

export function parseGoogleCalendarList(payload: {
  items?: GoogleCalendarListItem[];
}): CalendarInfo[] {
  return (payload.items ?? [])
    .filter((item) => item.id)
    .map((item) => ({
      id: item.id,
      summary: item.summary || item.id,
      primary: item.primary === true,
      ...(item.backgroundColor ? { backgroundColor: item.backgroundColor } : {}),
    }));
}

const HAS_OFFSET = /[zZ]$|[+-]\d{2}:?\d{2}$/;

export function parseGoogleDate(part: GoogleDateStamp | undefined): Date {
  if (!part) return new Date(0);
  if (part.dateTime) {
    if (HAS_OFFSET.test(part.dateTime)) return new Date(part.dateTime);
    if (part.timeZone === 'UTC' || part.timeZone === 'Etc/UTC' || part.timeZone === 'Etc/GMT') {
      return new Date(part.dateTime.endsWith('Z') ? part.dateTime : `${part.dateTime}Z`);
    }
    return new Date(part.dateTime);
  }
  if (part.date) return new Date(`${part.date}T00:00:00`);
  return new Date(0);
}

export function parseGoogleEvents(
  payload: { items?: GoogleEventItem[] },
  color?: string
): CalendarEvent[] {
  return (payload.items ?? []).map((event) => {
    const isAllDay = !event.start.dateTime && !!event.start.date;
    const self = event.attendees?.find((attendee) => attendee.self);
    const video = event.conferenceData?.entryPoints?.find((entry) => entry.uri);
    const status = event.status?.toLowerCase();

    return {
      summary: event.summary || 'Untitled Event',
      start: parseGoogleDate(event.start),
      end: parseGoogleDate(event.end),
      isAllDay,
      status:
        status === 'cancelled' || status === 'confirmed' || status === 'tentative'
          ? status
          : undefined,
      transparency: event.transparency === 'transparent' ? 'transparent' : 'opaque',
      declined: self?.responseStatus === 'declined' || status === 'cancelled',
      hangoutLink: event.hangoutLink,
      location: event.location,
      description: event.description,
      conferenceUri: video?.uri,
      backgroundColor: color,
    };
  });
}

export function mergeEventsFromCalendars(
  eventsById: Record<string, CalendarEvent[]>,
  selectedIds: string[]
): CalendarEvent[] {
  const merged: CalendarEvent[] = [];
  for (const id of selectedIds) {
    const events = eventsById[id];
    if (events) {
      merged.push(...events.map((event) => ({ ...event, calendarId: event.calendarId ?? id })));
    }
  }
  return merged.sort((a, b) => a.start.getTime() - b.start.getTime());
}

function at(now: Date, hours: number, minutes: number): Date {
  const d = new Date(now);
  d.setHours(hours, minutes, 0, 0);
  return d;
}

export function getMockGoogleEventsByCalendar(now: Date): Record<string, CalendarEvent[]> {
  return {
    primary: [
      {
        summary: 'Lunch',
        start: at(now, 12, 0),
        end: at(now, 12, 30),
        isAllDay: false,
        backgroundColor: '#4285f4',
      },
    ],
    'work@company.com': [
      {
        summary: 'Sprint planning',
        start: at(now, 15, 0),
        end: at(now, 16, 0),
        isAllDay: false,
        backgroundColor: '#f6bf26',
      },
    ],
  };
}

type FetchLike = (
  input: string,
  init?: { headers?: Record<string, string> }
) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

export async function fetchGoogleCalendarList(
  accessToken: string,
  fetchImpl: FetchLike = fetch
): Promise<CalendarInfo[]> {
  const response = await fetchImpl(
    'https://www.googleapis.com/calendar/v3/users/me/calendarList',
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!response.ok) {
    throw new Error(`Google calendar list failed: ${response.status}`);
  }
  return parseGoogleCalendarList((await response.json()) as { items?: GoogleCalendarListItem[] });
}

export async function fetchGoogleCalendarEvents(
  accessToken: string,
  calendarId: string,
  range: { timeMin: string; timeMax: string },
  fetchImpl: FetchLike = fetch
): Promise<CalendarEvent[]> {
  const params = new URLSearchParams({
    timeMin: range.timeMin,
    timeMax: range.timeMax,
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '250',
    conferenceDataVersion: '1',
  });

  const response = await fetchImpl(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!response.ok) {
    throw new Error(`Google events failed: ${response.status}`);
  }
  return parseGoogleEvents((await response.json()) as { items?: GoogleEventItem[] });
}

export async function fetchMergedGoogleEvents(
  accessToken: string,
  calendarIds: string[],
  range: { timeMin: string; timeMax: string },
  fetchImpl: FetchLike = fetch
): Promise<CalendarEvent[]> {
  const ids = calendarIds.length > 0 ? calendarIds : ['primary'];
  const eventsById: Record<string, CalendarEvent[]> = {};
  for (const id of ids) {
    try {
      eventsById[id] = await fetchGoogleCalendarEvents(accessToken, id, range, fetchImpl);
    } catch {
      eventsById[id] = [];
    }
  }
  return mergeEventsFromCalendars(eventsById, ids);
}
