import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'focusOrb:manualFocus';

interface FocusSession {
  startTime: number;
  duration: number; // minutes
}

export function useManualFocus() {
  const [session, setSession] = useState<FocusSession | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);

  // Load session from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as FocusSession;
        const elapsed = (Date.now() - parsed.startTime) / (1000 * 60);
        
        // Only restore if session is still active
        if (elapsed < parsed.duration) {
          setSession(parsed);
        } else {
          localStorage.removeItem(STORAGE_KEY);
        }
      } catch (err) {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, []);

  // Save session to localStorage
  useEffect(() => {
    if (session) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [session]);

  // Update time remaining
  useEffect(() => {
    if (!session) {
      setTimeRemaining(null);
      return;
    }

    const updateTimeRemaining = () => {
      const elapsed = (Date.now() - session.startTime) / (1000 * 60);
      const remaining = session.duration - elapsed;

      if (remaining <= 0) {
        setSession(null);
        setTimeRemaining(null);
      } else {
        setTimeRemaining(remaining);
      }
    };

    updateTimeRemaining();
    const interval = setInterval(updateTimeRemaining, 1000);

    return () => clearInterval(interval);
  }, [session]);

  const startFocus = useCallback((duration: number) => {
    setSession({
      startTime: Date.now(),
      duration,
    });
  }, []);

  const stopFocus = useCallback(() => {
    setSession(null);
  }, []);

  return {
    isActive: session !== null,
    timeRemaining,
    totalDuration: session?.duration ?? null,
    startFocus,
    stopFocus,
  };
}
