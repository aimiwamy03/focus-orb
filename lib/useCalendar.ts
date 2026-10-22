import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { parseICS, expandRecurringEvents, findNextEvent, NextEventInfo, CalendarEvent } from './calendar';
import { buildDayModel, DayModel, minutesBetween } from './day';
import { getMockEvents, isMockScenario, resolveDemoNow } from './fixtures';
import {
  CalendarInfo,
  getMockGoogleEventsByCalendar,
  loadSelectedCalendarIds,
  mergeEventsFromCalendars,
  MOCK_GOOGLE_CALENDARS,
  resolveSelectedCalendarIds,
  sameCalendarIds,
  saveSelectedCalendarIds,
} from './calendars';
import { interpretAuthSession, shouldUseGoogleFromSession } from './onboarding';

const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes
const STORAGE_KEY = 'focusOrb:calendarUrl';
const SCATTER_WINDOW_KEY = 'focusOrb:scatterWindow';
const AUTH_METHOD_KEY = 'focusOrb:authMethod';
const CLOCK_INTERVAL = 30 * 1000;

type AuthMethod = 'google' | 'ical' | null;

function emptyDay(now: Date): DayModel {
  return buildDayModel([], now);
}

export function useCalendar() {
  const searchParams = useSearchParams();
  const mockParam = searchParams.get('mock');
  const nowParam = searchParams.get('now');
  const mockCalendars = searchParams.get('mockCalendars') === '1';
  const mockScenario = isMockScenario(mockParam) ? mockParam : null;

  const [calendarUrl, setCalendarUrl] = useState<string>('');
  const [scatterWindow, setScatterWindow] = useState<number>(15);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [nextEvent, setNextEvent] = useState<NextEventInfo | null>(null);
  const [now, setNow] = useState(() => resolveDemoNow(nowParam, mockScenario));
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [day, setDay] = useState<DayModel>(() => emptyDay(resolveDemoNow(nowParam, mockScenario)));
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authMethod, setAuthMethod] = useState<AuthMethod>(null);
  const [isGoogleConnected, setIsGoogleConnected] = useState(false);
  const [calendars, setCalendars] = useState<CalendarInfo[]>([]);
  const [selectedCalendarIds, setSelectedCalendarIds] = useState<string[]>([]);

  // Pin or tick the clock. Mock fixtures never depend on wall time.
  useEffect(() => {
    const pinned = resolveDemoNow(nowParam, mockScenario);
    setNow(pinned);
    if (nowParam || mockScenario) return;

    const interval = setInterval(() => setNow(new Date()), CLOCK_INTERVAL);
    return () => clearInterval(interval);
  }, [nowParam, mockScenario]);

  // Load settings from localStorage
  useEffect(() => {
    const storedUrl = localStorage.getItem(STORAGE_KEY);
    const storedWindow = localStorage.getItem(SCATTER_WINDOW_KEY);
    const storedAuthMethod = localStorage.getItem(AUTH_METHOD_KEY) as AuthMethod;
    const storedCalendars = loadSelectedCalendarIds();
    
    if (storedUrl) setCalendarUrl(storedUrl);
    if (storedWindow) setScatterWindow(parseInt(storedWindow, 10));
    if (storedAuthMethod) setAuthMethod(storedAuthMethod);
    if (storedCalendars) setSelectedCalendarIds(storedCalendars);
  }, []);

  useEffect(() => {
    if (mockCalendars) {
      setAuthMethod('google');
      setIsGoogleConnected(true);
      setCalendars(MOCK_GOOGLE_CALENDARS);
      setSelectedCalendarIds((current) => {
        const resolved = resolveSelectedCalendarIds(
          MOCK_GOOGLE_CALENDARS,
          current.length > 0 ? current : loadSelectedCalendarIds()
        );
        return sameCalendarIds(current, resolved) ? current : resolved;
      });
    }
  }, [mockCalendars]);

  // Sign-in redirects away before Settings can write localStorage, so a
  // signed-in user must be detected from the NextAuth session, not only
  // from focusOrb:authMethod.
  useEffect(() => {
    if (mockScenario || mockCalendars) return;

    let cancelled = false;

    const syncGoogleSession = async () => {
      try {
        const sessionResponse = await fetch('/api/auth/session');
        if (!sessionResponse.ok) return;
        const view = interpretAuthSession(await sessionResponse.json());
        if (cancelled) return;

        const storedMethod = localStorage.getItem(AUTH_METHOD_KEY);
        setUserEmail(view.email);
        if (shouldUseGoogleFromSession(view)) {
          setAuthMethod('google');
          localStorage.setItem(AUTH_METHOD_KEY, 'google');
        } else if (storedMethod !== 'google') {
          return;
        }

        const response = await fetch('/api/calendar/google');
        if (cancelled) return;
        setIsGoogleConnected(response.ok);
        if (!response.ok && response.status === 401) {
          setAuthMethod(null);
          setIsGoogleConnected(false);
          localStorage.removeItem(AUTH_METHOD_KEY);
        }
      } catch {
        if (!cancelled) setIsGoogleConnected(false);
      }
    };

    syncGoogleSession();
    return () => {
      cancelled = true;
    };
  }, [mockScenario, mockCalendars]);

  // Save settings to localStorage
  useEffect(() => {
    if (calendarUrl) {
      localStorage.setItem(STORAGE_KEY, calendarUrl);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [calendarUrl]);

  useEffect(() => {
    localStorage.setItem(SCATTER_WINDOW_KEY, scatterWindow.toString());
  }, [scatterWindow]);

  const applyEvents = (incoming: CalendarEvent[], clock: Date) => {
    const model = buildDayModel(incoming, clock);
    setEvents(incoming);
    setDay(model);

    if (model.nextEvent) {
      setNextEvent({
        summary: model.nextEvent.summary,
        start: model.nextEvent.start,
        minutesToStart: minutesBetween(clock, model.nextEvent.start),
        scatterWindow,
      });
    } else {
      setNextEvent(findNextEvent(incoming, scatterWindow, clock));
    }
  };

  const fetchGoogleCalendar = async (clock: Date, calendarIds: string[] = selectedCalendarIds) => {
    setIsLoading(true);
    setError(null);

    try {
      const listResponse = await fetch('/api/calendar/google?list=1');
      if (!listResponse.ok) {
        if (listResponse.status === 401) {
          setIsGoogleConnected(false);
          setAuthMethod(null);
          localStorage.removeItem(AUTH_METHOD_KEY);
          throw new Error('Google authentication expired');
        }
        throw new Error(`Failed to fetch calendars: ${listResponse.statusText}`);
      }

      const listData = (await listResponse.json()) as { calendars: CalendarInfo[] };
      const listed = listData.calendars ?? [];
      setCalendars(listed);

      const resolved = resolveSelectedCalendarIds(
        listed,
        calendarIds.length > 0 ? calendarIds : loadSelectedCalendarIds()
      );
      setSelectedCalendarIds((current) => {
        if (sameCalendarIds(current, resolved)) return current;
        saveSelectedCalendarIds(resolved);
        return resolved;
      });

      const params = new URLSearchParams({ calendars: resolved.join(',') });
      const response = await fetch(`/api/calendar/google?${params}`);
      
      if (!response.ok) {
        if (response.status === 401) {
          setIsGoogleConnected(false);
          setAuthMethod(null);
          localStorage.removeItem(AUTH_METHOD_KEY);
          throw new Error('Google authentication expired');
        }
        throw new Error(`Failed to fetch calendar: ${response.statusText}`);
      }

      const data = await response.json();
      const mapped: CalendarEvent[] = data.events.map((e: CalendarEvent & { start: string; end: string }) => ({
        summary: e.summary,
        start: new Date(e.start),
        end: new Date(e.end),
        isAllDay: e.isAllDay || false,
        status: e.status,
        transparency: e.transparency,
        declined: e.declined,
        hangoutLink: e.hangoutLink,
        location: e.location,
        description: e.description,
        conferenceUri: e.conferenceUri,
      }));
      
      applyEvents(mapped, clock);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch calendar');
      applyEvents([], clock);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchICalCalendar = async (clock: Date) => {
    if (!calendarUrl) {
      applyEvents([], clock);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: calendarUrl }),
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch calendar: ${response.statusText}`);
      }

      const icsContent = await response.text();
      const parsed = parseICS(icsContent);
      const expanded = expandRecurringEvents(parsed);
      applyEvents(expanded, clock);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch calendar');
      applyEvents([], clock);
    } finally {
      setIsLoading(false);
    }
  };

  const applyMockGoogleSelection = (clock: Date, calendarIds: string[]) => {
    const resolved = resolveSelectedCalendarIds(MOCK_GOOGLE_CALENDARS, calendarIds);
    applyEvents(
      mergeEventsFromCalendars(getMockGoogleEventsByCalendar(clock), resolved),
      clock
    );
  };

  const fetchCalendar = async (clock: Date = now, calendarIds: string[] = selectedCalendarIds) => {
    if (mockScenario) {
      applyEvents(getMockEvents(mockScenario, clock), clock);
      return;
    }

    if (mockCalendars) {
      applyMockGoogleSelection(clock, calendarIds);
      return;
    }

    if (authMethod === 'google' && isGoogleConnected) {
      await fetchGoogleCalendar(clock, calendarIds);
    } else if (authMethod === 'ical' || calendarUrl) {
      await fetchICalCalendar(clock);
    } else {
      applyEvents([], clock);
    }
  };

  // Mock fixtures or live calendar
  useEffect(() => {
    if (mockScenario) {
      applyEvents(getMockEvents(mockScenario, now), now);
      return;
    }
    fetchCalendar(now);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mockScenario, mockCalendars, now, calendarUrl, scatterWindow, authMethod, isGoogleConnected, selectedCalendarIds]);

  // Refresh calendar periodically
  useEffect(() => {
    if (mockScenario || mockCalendars) return;
    if (!calendarUrl && !isGoogleConnected) return;

    const interval = setInterval(() => fetchCalendar(now), REFRESH_INTERVAL);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mockScenario, mockCalendars, calendarUrl, scatterWindow, authMethod, isGoogleConnected, now]);

  const disconnectGoogle = async () => {
    try {
      const response = await fetch('/api/auth/signout', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      
      if (response.ok) {
        setIsGoogleConnected(false);
        setAuthMethod(null);
        applyEvents([], now);
        localStorage.removeItem(AUTH_METHOD_KEY);
        
        // Redirect to clear session
        window.location.href = '/';
      }
    } catch {
      setError('Failed to disconnect');
    }
  };

  const selectAuthMethod = (method: AuthMethod) => {
    setAuthMethod(method);
    if (method) {
      localStorage.setItem(AUTH_METHOD_KEY, method);
    } else {
      localStorage.removeItem(AUTH_METHOD_KEY);
    }
  };

  const toggleCalendar = useCallback((id: string) => {
    setSelectedCalendarIds((current) => {
      const next = current.includes(id)
        ? current.filter((calendarId) => calendarId !== id)
        : [...current, id];
      saveSelectedCalendarIds(next);
      return next;
    });
  }, []);

  return {
    calendarUrl,
    setCalendarUrl,
    scatterWindow,
    setScatterWindow,
    events,
    day,
    now,
    nextEvent,
    isLoading,
    error,
    refreshCalendar: () => fetchCalendar(now),
    authMethod,
    selectAuthMethod,
    isGoogleConnected: isGoogleConnected || mockCalendars,
    disconnectGoogle,
    mockScenario,
    calendars,
    selectedCalendarIds,
    toggleCalendar,
    userEmail,
  };
}
