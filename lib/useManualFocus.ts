import { useState, useEffect, useCallback } from 'react';
import { BREAK_MINUTES, FALLBACK_TASK } from './focusPrompt';

const STORAGE_KEY = 'focusOrb:manualFocus';

interface FocusSession {
  startTime: number;
  duration: number;
  task: string;
  kind: 'focus' | 'break';
}

export interface CompletedFocus {
  task: string;
  minutes: number;
  planned: number;
}

export function useManualFocus() {
  const [session, setSession] = useState<FocusSession | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [completed, setCompleted] = useState<CompletedFocus | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as FocusSession;
        const elapsed = (Date.now() - parsed.startTime) / (1000 * 60);
        if (elapsed < parsed.duration) {
          setSession({
            ...parsed,
            task: parsed.task || FALLBACK_TASK,
            kind: parsed.kind === 'break' ? 'break' : 'focus',
          });
        } else {
          localStorage.removeItem(STORAGE_KEY);
        }
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, []);

  useEffect(() => {
    if (session) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [session]);

  useEffect(() => {
    if (!session) {
      setTimeRemaining(null);
      return;
    }

    const updateTimeRemaining = () => {
      const elapsed = (Date.now() - session.startTime) / (1000 * 60);
      const remaining = session.duration - elapsed;

      if (remaining <= 0) {
        if (session.kind === 'focus') {
          setCompleted({
            task: session.task,
            minutes: session.duration,
            planned: session.duration,
          });
        }
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

  const startFocus = useCallback((duration: number, task?: string) => {
    setCompleted(null);
    setSession({
      startTime: Date.now(),
      duration,
      task: (task ?? '').trim() || FALLBACK_TASK,
      kind: 'focus',
    });
  }, []);

  const startBreak = useCallback(() => {
    setCompleted(null);
    setSession({
      startTime: Date.now(),
      duration: BREAK_MINUTES,
      task: 'Break',
      kind: 'break',
    });
  }, []);

  const stopFocus = useCallback(() => {
    setSession((current) => {
      if (current?.kind === 'focus') {
        const elapsed = (Date.now() - current.startTime) / (1000 * 60);
        const spent = Math.max(1, Math.min(current.duration, Math.round(elapsed) || 1));
        setCompleted({
          task: current.task,
          minutes: spent,
          planned: current.duration,
        });
      } else {
        setCompleted(null);
      }
      return null;
    });
  }, []);

  const dismissCompleted = useCallback(() => {
    setCompleted(null);
  }, []);

  const seedCompleted = useCallback((task: string, minutes: number, planned = minutes) => {
    setSession(null);
    setCompleted({ task, minutes, planned });
  }, []);

  return {
    isActive: session !== null && session.kind === 'focus',
    isBreak: session?.kind === 'break',
    task: session?.task ?? completed?.task ?? '',
    timeRemaining,
    totalDuration: session?.duration ?? null,
    completed,
    startFocus,
    startBreak,
    stopFocus,
    dismissCompleted,
    seedCompleted,
  };
}
