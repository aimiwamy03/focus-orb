import { useState, useEffect } from 'react';
import { parseICS, expandRecurringEvents, findNextEvent, NextEventInfo } from './calendar';

const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes
const STORAGE_KEY = 'focusOrb:calendarUrl';
const SCATTER_WINDOW_KEY = 'focusOrb:scatterWindow';
const AUTH_METHOD_KEY = 'focusOrb:authMethod';

type AuthMethod = 'google' | 'ical' | null;

export function useCalendar() {
  const [calendarUrl, setCalendarUrl] = useState<string>('');
  const [scatterWindow, setScatterWindow] = useState<number>(60);
  const [nextEvent, setNextEvent] = useState<NextEventInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authMethod, setAuthMethod] = useState<AuthMethod>(null);
  const [isGoogleConnected, setIsGoogleConnected] = useState(false);

  // Load settings from localStorage
  useEffect(() => {
    const storedUrl = localStorage.getItem(STORAGE_KEY);
    const storedWindow = localStorage.getItem(SCATTER_WINDOW_KEY);
    const storedAuthMethod = localStorage.getItem(AUTH_METHOD_KEY) as AuthMethod;
    
    if (storedUrl) setCalendarUrl(storedUrl);
    if (storedWindow) setScatterWindow(parseInt(storedWindow, 10));
    if (storedAuthMethod) setAuthMethod(storedAuthMethod);
  }, []);

  // Check Google authentication status
  useEffect(() => {
    const checkGoogleAuth = async () => {
      try {
        const response = await fetch('/api/calendar/google');
        setIsGoogleConnected(response.ok);
        if (response.ok && !authMethod) {
          setAuthMethod('google');
          localStorage.setItem(AUTH_METHOD_KEY, 'google');
        }
      } catch {
        setIsGoogleConnected(false);
      }
    };
    
    checkGoogleAuth();
  }, [authMethod]);

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

  const fetchGoogleCalendar = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/calendar/google');
      
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
      const events = data.events.map((e: any) => ({
        summary: e.summary,
        start: new Date(e.start),
        end: new Date(e.end),
        isAllDay: e.isAllDay || false,
      }));
      
      const next = findNextEvent(events, scatterWindow);
      setNextEvent(next);
    } catch (err) {
      console.error('Google calendar fetch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch calendar');
      setNextEvent(null);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchICalCalendar = async () => {
    if (!calendarUrl) {
      setNextEvent(null);
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
      const events = parseICS(icsContent);
      const expanded = expandRecurringEvents(events);
      const next = findNextEvent(expanded, scatterWindow);
      
      setNextEvent(next);
    } catch (err) {
      console.error('Calendar fetch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch calendar');
      setNextEvent(null);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCalendar = async () => {
    if (authMethod === 'google' && isGoogleConnected) {
      await fetchGoogleCalendar();
    } else if (authMethod === 'ical' || calendarUrl) {
      await fetchICalCalendar();
    } else {
      setNextEvent(null);
    }
  };

  // Fetch calendar on mount and when URL/window/auth changes
  useEffect(() => {
    fetchCalendar();
  }, [calendarUrl, scatterWindow, authMethod, isGoogleConnected]);

  // Refresh calendar periodically
  useEffect(() => {
    if (!calendarUrl && !isGoogleConnected) return;

    const interval = setInterval(fetchCalendar, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [calendarUrl, scatterWindow, authMethod, isGoogleConnected]);

  const disconnectGoogle = async () => {
    try {
      const response = await fetch('/api/auth/signout', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      
      if (response.ok) {
        setIsGoogleConnected(false);
        setAuthMethod(null);
        setNextEvent(null);
        localStorage.removeItem(AUTH_METHOD_KEY);
        
        // Redirect to clear session
        window.location.href = '/';
      }
    } catch (err) {
      console.error('Failed to disconnect:', err);
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

  return {
    calendarUrl,
    setCalendarUrl,
    scatterWindow,
    setScatterWindow,
    nextEvent,
    isLoading,
    error,
    refreshCalendar: fetchCalendar,
    authMethod,
    selectAuthMethod,
    isGoogleConnected,
    disconnectGoogle,
  };
}
