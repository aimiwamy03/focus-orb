export type FocusLogEnded = 'completed' | 'ended-early' | 'ended-session';

export interface FocusLogEntry {
  id: string;
  task: string;
  startMs: number;
  endMs: number;
  minutes: number;
  planned: number;
  ended: FocusLogEnded;
}

export interface FocusLogTaskTotal {
  task: string;
  minutes: number;
}

export interface FocusLogDay {
  key: string;
  label: string;
  heading: string;
  isToday: boolean;
  minutes: number;
  entries: FocusLogEntry[];
  byTask: FocusLogTaskTotal[];
}

export const FOCUS_LOG_KEY = 'focusOrb:focusLog';
export const FOCUS_LOG_MOCK_KEY = 'focusOrb:focusLog:mock';
export const LOG_LABEL = 'Log';
export const LOG_EMPTY = 'No focus yet today. Your sessions will show up here.';
export const LOG_ENDED_EARLY = 'ended early';
export const LOG_BY_TASK = 'By task';
export const CLEAR_LOG_LABEL = 'Clear log';
export const CLEAR_LOG_PROMPT = 'Clear the focus log?';
export const DELETE_LOG_PROMPT = 'Delete this session?';
export const KEEP_LOG_LABEL = 'Keep';
export const DELETE_LABEL = 'Delete';
export const CLEAR_LABEL = 'Clear';

export function focusLogKey(input: { email?: string | null; mock?: boolean }): string {
  if (input.mock) return FOCUS_LOG_MOCK_KEY;
  const email = (input.email ?? '').trim().toLowerCase();
  if (email) return `${FOCUS_LOG_KEY}:${email}`;
  return FOCUS_LOG_KEY;
}

function startOfLocalDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function addDays(date: Date, days: number): Date {
  const next = startOfLocalDay(date);
  next.setDate(next.getDate() + days);
  return next;
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function period(date: Date): 'am' | 'pm' {
  return date.getHours() >= 12 ? 'pm' : 'am';
}

export function formatLogClock(date: Date, withPeriod = false): string {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const hour12 = hours % 12 || 12;
  const time = `${hour12}:${String(minutes).padStart(2, '0')}`;
  return withPeriod ? `${time}${period(date)}` : time;
}

export function formatLogRange(start: Date, end: Date): string {
  const startPeriod = period(start);
  const endPeriod = period(end);
  if (startPeriod === endPeriod) {
    return `${formatLogClock(start)}-${formatLogClock(end)}${endPeriod}`;
  }
  return `${formatLogClock(start, true)}-${formatLogClock(end, true)}`;
}

export function formatFocusedMinutes(
  minutes: number,
  planned: number,
  ended: FocusLogEnded
): string {
  const spent = Math.max(1, Math.round(minutes));
  const total = Math.max(spent, Math.round(planned));
  if (ended !== 'completed' && spent < total) return `${spent} of ${total} min`;
  return `${spent} min`;
}

export function formatDayFocused(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  if (hours <= 0) return `${mins}m`;
  if (mins <= 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

export function formatLogDayHeading(label: string, minutes: number): string {
  return `${label}, ${formatDayFocused(minutes)} focused`;
}

export function formatLogDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export function dayLabel(date: Date, now: Date): string {
  const day = startOfLocalDay(date);
  if (sameDay(day, now)) return 'Today';
  if (sameDay(day, addDays(now, -1))) return 'Yesterday';
  return formatLogDate(day);
}

export function taskTotals(entries: FocusLogEntry[]): FocusLogTaskTotal[] {
  const totals = new Map<string, number>();
  for (const entry of entries) {
    totals.set(entry.task, (totals.get(entry.task) ?? 0) + entry.minutes);
  }
  return [...totals.entries()]
    .map(([task, minutes]) => ({ task, minutes }))
    .sort((a, b) => b.minutes - a.minutes || a.task.localeCompare(b.task));
}

export function groupFocusLog(entries: FocusLogEntry[], now: Date = new Date()): FocusLogDay[] {
  const buckets = new Map<number, FocusLogEntry[]>();
  const ordered = [...entries].sort((a, b) => b.startMs - a.startMs);
  for (const entry of ordered) {
    const key = startOfLocalDay(new Date(entry.startMs)).getTime();
    const list = buckets.get(key) ?? [];
    list.push(entry);
    buckets.set(key, list);
  }
  const todayKey = startOfLocalDay(now).getTime();
  if (entries.length > 0 && !buckets.has(todayKey)) {
    buckets.set(todayKey, []);
  }
  return [...buckets.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([key, dayEntries]) => {
      const date = new Date(key);
      const label = dayLabel(date, now);
      const minutes = dayEntries.reduce((sum, entry) => sum + entry.minutes, 0);
      const isToday = label === 'Today';
      return {
        key: String(key),
        label,
        heading: minutes > 0 ? formatLogDayHeading(label, minutes) : label,
        isToday,
        minutes,
        entries: dayEntries.sort((a, b) => b.startMs - a.startMs),
        byTask: isToday ? taskTotals(dayEntries) : [],
      };
    });
}

function isEntry(value: unknown): value is FocusLogEntry {
  if (!value || typeof value !== 'object') return false;
  const entry = value as FocusLogEntry;
  return (
    typeof entry.id === 'string' &&
    typeof entry.task === 'string' &&
    typeof entry.startMs === 'number' &&
    typeof entry.endMs === 'number' &&
    typeof entry.minutes === 'number' &&
    typeof entry.planned === 'number' &&
    (entry.ended === 'completed' ||
      entry.ended === 'ended-early' ||
      entry.ended === 'ended-session')
  );
}

export function loadFocusLog(key: string): FocusLogEntry[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isEntry);
  } catch {
    return [];
  }
}

export function saveFocusLog(key: string, entries: FocusLogEntry[]): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(key, JSON.stringify(entries));
}

export function makeFocusLogId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function recordFocusLog(
  key: string,
  draft: Omit<FocusLogEntry, 'id'>
): FocusLogEntry[] {
  const entry: FocusLogEntry = { ...draft, id: makeFocusLogId() };
  const next = [entry, ...loadFocusLog(key)];
  saveFocusLog(key, next);
  return next;
}

export function deleteFocusLogEntry(key: string, id: string): FocusLogEntry[] {
  const next = loadFocusLog(key).filter((entry) => entry.id !== id);
  saveFocusLog(key, next);
  return next;
}

export function clearFocusLog(key: string): FocusLogEntry[] {
  saveFocusLog(key, []);
  return [];
}

export function atLocal(day: Date, hours: number, minutes = 0): Date {
  const next = new Date(day);
  next.setHours(hours, minutes, 0, 0);
  return next;
}

export function getFocusLogFixture(now: Date = new Date()): FocusLogEntry[] {
  const today = startOfLocalDay(now);
  const yesterday = addDays(now, -1);
  const earlier = addDays(now, -3);
  const entry = (
    id: string,
    day: Date,
    startH: number,
    startM: number,
    minutes: number,
    planned: number,
    task: string,
    ended: FocusLogEnded
  ): FocusLogEntry => {
    const start = atLocal(day, startH, startM);
    return {
      id,
      task,
      startMs: start.getTime(),
      endMs: start.getTime() + minutes * 60_000,
      minutes,
      planned,
      ended,
    };
  };
  return [
    entry('today-voice', today, 14, 10, 25, 25, 'finish voice ai post', 'completed'),
    entry('today-spec', today, 10, 0, 50, 50, 'write the spec', 'completed'),
    entry('today-review', today, 16, 5, 20, 50, 'review pr', 'ended-early'),
    entry('yday-voice', yesterday, 9, 30, 50, 50, 'finish voice ai post', 'completed'),
    entry('yday-lab', yesterday, 13, 0, 90, 90, 'Production Agent Lab', 'completed'),
    entry('older-plan', earlier, 11, 0, 25, 25, 'plan the week', 'completed'),
  ];
}
