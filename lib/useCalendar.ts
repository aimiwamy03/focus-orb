import { useState, useEffect } from 'react';
import { parseICS, expandRecurringEvents, findNextEvent, NextEventInfo } from './calendar';

const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes
const STORAGE_KEY = 'focusOrb:calendarUrl';
const SCATTER_WINDOW_KEY = 'focusOrb:scatterWindow';

export function useCalendar() {
  const [calendarUrl, setCalendarUrl] = useState<string>('');
  const [scatterWindow, setScatterWindow] = useState<number>(60);
  const [nextEvent, setNextEvent] = useState<NextEventInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load settings from localStorage
  useEffect(() => {
    const storedUrl = localStorage.getItem(STORAGE_KEY);
    const storedWindow = localStorage.getItem(SCATTER_WINDOW_KEY);
    
    if (storedUrl) setCalendarUrl(storedUrl);
    if (storedWindow) setScatterWindow(parseInt(storedWindow, 10));
  }, []);

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

  const fetchCalendar = async () => {
    if (!calendarUrl) {
      setNextEvent(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Fetch through proxy API route to avoid CORS
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

  // Fetch calendar on mount and when URL/window changes
  useEffect(() => {
    fetchCalendar();
  }, [calendarUrl, scatterWindow]);

  // Refresh calendar periodically
  useEffect(() => {
    if (!calendarUrl) return;

    const interval = setInterval(fetchCalendar, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [calendarUrl, scatterWindow]);

  return {
    calendarUrl,
    setCalendarUrl,
    scatterWindow,
    setScatterWindow,
    nextEvent,
    isLoading,
    error,
    refreshCalendar: fetchCalendar,
  };
}
