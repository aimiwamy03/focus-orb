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

export interface GoogleEventItem {
  summary?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  status?: string;
  transparency?: string;
  hangoutLink?: string;
  location?: string;
  description?: string;
  attendees?: { self?: boolean; responseStatus?: string }[];
  conferenceData?: { entryPoints?: { entryPointType?: string; uri?: string }[] };
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
  const primary = calendars.find((calendar) => calendar.primary);
  if (primary) return [primary.id];
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
      start: new Date(event.start.dateTime || event.start.date || 0),
      end: new Date(event.end.dateTime || event.end.date || 0),
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
    maxResults: '50',
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
    eventsById[id] = await fetchGoogleCalendarEvents(accessToken, id, range, fetchImpl);
  }
  return mergeEventsFromCalendars(eventsById, ids);
}
