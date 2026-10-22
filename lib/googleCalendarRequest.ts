import {
  fetchGoogleCalendarList,
  fetchMergedGoogleEvents,
  type CalendarInfo,
} from './calendars';
import type { CalendarEvent } from './calendar';

export interface CalendarSession {
  accessToken?: string | null;
}

export interface GoogleCalendarResult {
  status: number;
  body: Record<string, unknown>;
}

type ListFn = typeof fetchGoogleCalendarList;
type EventsFn = typeof fetchMergedGoogleEvents;

export function isPrerenderAbortError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const digest = 'digest' in error ? String((error as { digest?: unknown }).digest ?? '') : '';
  if (digest === 'HANGING_PROMISE_REJECTION' || digest.includes('PRERENDER')) {
    return true;
  }
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes('During prerendering') &&
    (message.includes('headers()') || message.includes('cookies()'))
  );
}

export function serializeCalendarEvents(events: CalendarEvent[]) {
  return events.map((event) => ({
    ...event,
    start: event.start.toISOString(),
    end: event.end.toISOString(),
  }));
}

export async function handleGoogleCalendarGet(options: {
  session: CalendarSession | null;
  url: URL;
  now?: Date;
  fetchList?: ListFn;
  fetchEvents?: EventsFn;
}): Promise<GoogleCalendarResult> {
  const accessToken = options.session?.accessToken;
  if (!accessToken) {
    return { status: 401, body: { error: 'Not authenticated' } };
  }

  const fetchList = options.fetchList ?? fetchGoogleCalendarList;
  const fetchEvents = options.fetchEvents ?? fetchMergedGoogleEvents;

  if (options.url.searchParams.get('list') === '1') {
    const calendars: CalendarInfo[] = await fetchList(accessToken);
    return { status: 200, body: { calendars } };
  }

  const now = options.now ?? new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const timeMax = new Date(startOfDay);
  timeMax.setDate(timeMax.getDate() + 3);
  timeMax.setHours(23, 59, 59, 999);

  const calendarIds = (options.url.searchParams.get('calendars') ?? 'primary')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);

  const events = await fetchEvents(accessToken, calendarIds, {
    timeMin: startOfDay.toISOString(),
    timeMax: timeMax.toISOString(),
  });

  return {
    status: 200,
    body: { events: serializeCalendarEvents(events) },
  };
}

export function googleCalendarErrorResult(error: unknown): GoogleCalendarResult {
  if (isPrerenderAbortError(error)) {
    throw error;
  }
  const message = error instanceof Error ? error.message : 'Failed to fetch events';
  if (message.includes('401')) {
    return { status: 401, body: { error: 'Token expired' } };
  }
  return { status: 500, body: { error: 'Failed to fetch events' } };
}
