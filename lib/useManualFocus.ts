import { useState, useEffect, useCallback, useRef } from 'react';
import { BREAK_MINUTES, FALLBACK_TASK } from './focusPrompt';
import type { FocusLogEnded, FocusLogEntry } from './focusLog';

export type FocusLogDraft = Omit<FocusLogEntry, 'id'>;

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

export function draftFocusEnd(
  session: FocusSession,
  ended: FocusLogEnded,
  nowMs = Date.now()
): FocusLogDraft {
  const elapsed = (nowMs - session.startTime) / (1000 * 60);
  const minutes =
    ended === 'completed'
      ? Math.max(1, Math.round(session.duration))
      : Math.max(1, Math.min(session.duration, Math.round(elapsed) || 1));
  const endMs =
    ended === 'completed' ? session.startTime + session.duration * 60_000 : nowMs;
  return {
    task: session.task,
    startMs: session.startTime,
    endMs,
    minutes,
    planned: session.duration,
    ended,
  };
}

export function useManualFocus(options?: { onFocusEnded?: (draft: FocusLogDraft) => void }) {
  const [session, setSession] = useState<FocusSession | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [completed, setCompleted] = useState<CompletedFocus | null>(null);
  const onEndedRef = useRef(options?.onFocusEnded);
  const sessionRef = useRef<FocusSession | null>(null);
  const recordedStartRef = useRef<number | null>(null);
  onEndedRef.current = options?.onFocusEnded;
  sessionRef.current = session;

  const emitFocusEnd = useCallback((current: FocusSession, ended: FocusLogEnded, nowMs?: number) => {
    if (current.kind !== 'focus') return null;
    if (recordedStartRef.current === current.startTime) return null;
    recordedStartRef.current = current.startTime;
    const draft = draftFocusEnd(current, ended, nowMs);
    onEndedRef.current?.(draft);
    return draft;
  }, []);

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
        const draft = emitFocusEnd(session, 'completed');
        if (draft) {
          setCompleted({
            task: session.task,
            minutes: draft.minutes,
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
    recordedStartRef.current = null;
    setCompleted(null);
    setSession({
      startTime: Date.now(),
      duration,
      task: (task ?? '').trim() || FALLBACK_TASK,
      kind: 'focus',
    });
  }, []);

  const startBreak = useCallback(() => {
    recordedStartRef.current = null;
    setCompleted(null);
    setSession({
      startTime: Date.now(),
      duration: BREAK_MINUTES,
      task: 'Break',
      kind: 'break',
    });
  }, []);

  const stopFocus = useCallback(() => {
    const current = sessionRef.current;
    if (current?.kind === 'focus') {
      const draft = emitFocusEnd(current, 'ended-early');
      if (draft) {
        setCompleted({
          task: current.task,
          minutes: draft.minutes,
          planned: current.duration,
        });
      }
    } else {
      setCompleted(null);
    }
    setSession(null);
  }, [emitFocusEnd]);

  const endSession = useCallback(() => {
    const current = sessionRef.current;
    if (current?.kind === 'focus') {
      emitFocusEnd(current, 'ended-session');
    }
    setSession(null);
    setCompleted(null);
    setTimeRemaining(null);
  }, [emitFocusEnd]);

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
    endSession,
    dismissCompleted,
    seedCompleted,
  };
}
