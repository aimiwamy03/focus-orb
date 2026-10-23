export type FocusLogEnded = 'completed' | 'ended-early' | 'ended-session';

export interface FocusLogEntry {
  id: string;
  task: string;
  startMs: number;
  endMs: number;
  minutes: number;
  planned: number;
  ended: FocusLogEnded;
  pausedMinutes?: number;
  minutesCounted?: number;
  stageBefore?: number;
  stageAfter?: number;
  settleSkipped?: boolean;
  distracted?: boolean | null;
  focusRating?: number | null;
  nextStep?: string | null;
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

export interface FocusChartDay {
  key: string;
  startMs: number;
  date: Date;
  minutes: number;
  isToday: boolean;
  label: string;
}

export interface FocusChartSummary {
  total: number;
  average: number;
  max: number;
  hasData: boolean;
  best: FocusChartDay | null;
}

export const FOCUS_LOG_KEY = 'focusOrb:focusLog';
export const FOCUS_LOG_MOCK_KEY = 'focusOrb:focusLog:mock';
export const LOG_LABEL = 'Log';
export const LOG_EMPTY = 'No focus yet today. Your sessions will show up here.';
export const CLEAR_LOG_LABEL = 'Clear log';
export const CLEAR_LOG_PROMPT = 'Clear the focus log?';
export const KEEP_LOG_LABEL = 'Keep';
export const CLEAR_LABEL = 'Clear';
export const LOG_RANGE_DASH = '–';
export const LOG_DOT = '·';
export const CHART_DAYS = 14;
export const CHART_TITLE = 'Last 14 days';
export const CHART_EMPTY = 'Your focus will chart here.';
export const LONG_LOG_TASK =
  'Write the production agent launch recap and send it to the lab before standup';

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
  if (formatLogClock(start) === formatLogClock(end) && startPeriod === endPeriod) {
    return formatLogClock(start, true);
  }
  if (startPeriod === endPeriod) {
    return `${formatLogClock(start)}${LOG_RANGE_DASH}${formatLogClock(end)}${endPeriod}`;
  }
  return `${formatLogClock(start, true)}${LOG_RANGE_DASH}${formatLogClock(end, true)}`;
}

export function isStoppedEarly(ended: FocusLogEnded): boolean {
  return ended !== 'completed';
}

export function formatSessionTime(start: Date, end: Date, ended: FocusLogEnded): string {
  if (isStoppedEarly(ended)) return formatLogClock(start, true);
  return formatLogRange(start, end);
}

export function formatSessionSpent(minutes: number): string {
  if (minutes < 1) return '<1 min';
  return `${Math.max(1, Math.round(minutes))} min`;
}

export function formatSessionPlannedSuffix(planned: number): string {
  return ` / ${Math.max(0, Math.round(planned))}`;
}

export function formatFocusedMinutes(
  minutes: number,
  planned: number,
  ended: FocusLogEnded
): string {
  const spent = formatSessionSpent(minutes);
  if (!isStoppedEarly(ended)) return spent;
  return `${spent}${formatSessionPlannedSuffix(planned)}`;
}

export function sessionBarPercent(minutes: number, planned: number): number {
  if (planned <= 0) return minutes > 0 ? 100 : 4;
  return Math.min(100, Math.max(4, (minutes / planned) * 100));
}

export function formatDayFocused(minutes: number): string {
  if (minutes > 0 && minutes < 1) return '<1m';
  const total = Math.max(0, Math.round(minutes));
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  if (hours <= 0) return `${mins}m`;
  if (mins <= 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
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
  if (!buckets.has(todayKey)) {
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
        heading: label,
        isToday,
        minutes,
        entries: dayEntries.sort((a, b) => b.startMs - a.startMs),
        byTask: isToday ? taskTotals(dayEntries) : [],
      };
    });
}

export function chartFocusDays(
  entries: FocusLogEntry[],
  now: Date = new Date(),
  count: number = CHART_DAYS
): FocusChartDay[] {
  const today = startOfLocalDay(now);
  const buckets = new Map<number, number>();
  for (const entry of entries) {
    const key = startOfLocalDay(new Date(entry.startMs)).getTime();
    buckets.set(key, (buckets.get(key) ?? 0) + entry.minutes);
  }
  const days: FocusChartDay[] = [];
  for (let offset = count - 1; offset >= 0; offset--) {
    const date = addDays(today, -offset);
    const startMs = date.getTime();
    days.push({
      key: String(startMs),
      startMs,
      date,
      minutes: buckets.get(startMs) ?? 0,
      isToday: offset === 0,
      label: offset === 0 ? 'Today' : formatLogDate(date),
    });
  }
  return days;
}

export function summarizeChart(days: FocusChartDay[]): FocusChartSummary {
  const total = days.reduce((sum, day) => sum + day.minutes, 0);
  const active = days.filter((day) => day.minutes > 0);
  const average = active.length === 0 ? 0 : active.reduce((sum, day) => sum + day.minutes, 0) / active.length;
  const max = days.reduce((high, day) => Math.max(high, day.minutes), 0);
  let best: FocusChartDay | null = null;
  for (const day of days) {
    if (day.minutes <= 0) continue;
    if (
      !best ||
      day.minutes > best.minutes ||
      (day.minutes === best.minutes && day.startMs > best.startMs)
    ) {
      best = day;
    }
  }
  return { total, average, max, hasData: active.length > 0, best };
}

export function chartBarHeight(minutes: number, max: number, plot = 140, stub = 2): number {
  if (minutes <= 0 || max <= 0) return stub;
  return Math.max(stub, Math.round((minutes / max) * plot));
}

export function formatChartAvg(minutes: number): string {
  return `Avg ${formatDayFocused(Math.round(minutes))} a day`;
}

export function formatChartBest(day: FocusChartDay): string {
  return `Best: ${formatLogDate(day.date)}, ${formatDayFocused(day.minutes)}`;
}

export function formatChartTooltip(date: Date, minutes: number): string {
  return `${formatLogDate(date)} ${LOG_DOT} ${formatDayFocused(minutes)}`;
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

function optionalNumber(value: unknown): value is number | undefined {
  return value == null || (typeof value === 'number' && Number.isFinite(value));
}

function optionalBool(value: unknown): value is boolean | null | undefined {
  return value == null || typeof value === 'boolean';
}

export function loadFocusLog(key: string): FocusLogEntry[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => {
      if (!isEntry(item)) return false;
      if (!optionalNumber(item.pausedMinutes)) return false;
      if (!optionalNumber(item.minutesCounted)) return false;
      if (!optionalNumber(item.stageBefore)) return false;
      if (!optionalNumber(item.stageAfter)) return false;
      if (!optionalBool(item.settleSkipped)) return false;
      if (!optionalBool(item.distracted)) return false;
      if (!optionalNumber(item.focusRating)) return false;
      if (item.nextStep != null && typeof item.nextStep !== 'string') return false;
      return true;
    });
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

export function updateFocusLogEntry(
  key: string,
  id: string,
  patch: Partial<Omit<FocusLogEntry, 'id'>>
): FocusLogEntry[] {
  const next = loadFocusLog(key).map((entry) =>
    entry.id === id ? { ...entry, ...patch, id: entry.id } : entry
  );
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

function fixtureEntry(
  id: string,
  day: Date,
  startH: number,
  startM: number,
  minutes: number,
  planned: number,
  task: string,
  ended: FocusLogEnded
): FocusLogEntry {
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
}

export function getFocusLogFixture(now: Date = new Date()): FocusLogEntry[] {
  const today = startOfLocalDay(now);
  const yesterday = addDays(now, -1);
  const earlier = addDays(now, -3);
  return [
    fixtureEntry('today-voice', today, 14, 10, 25, 25, 'finish voice ai post', 'completed'),
    fixtureEntry('today-spec', today, 10, 0, 50, 50, 'write the spec', 'completed'),
    fixtureEntry('today-review', today, 16, 5, 20, 50, 'review pr', 'ended-early'),
    fixtureEntry('yday-voice', yesterday, 9, 30, 50, 50, 'finish voice ai post', 'completed'),
    fixtureEntry('yday-lab', yesterday, 13, 0, 90, 90, 'Production Agent Lab', 'completed'),
    fixtureEntry('older-plan', earlier, 11, 0, 25, 25, 'plan the week', 'completed'),
  ];
}

export function getFocusLogRedesignFixture(now: Date = new Date()): FocusLogEntry[] {
  const yesterday = addDays(now, -1);
  const hourDay = addDays(now, -2);
  const earlier = addDays(now, -3);
  return [
    fixtureEntry('yday-done', yesterday, 21, 1, 25, 25, 's', 'completed'),
    fixtureEntry('yday-early-a', yesterday, 21, 1, 1, 25, 's', 'ended-early'),
    fixtureEntry('yday-early-b', yesterday, 21, 0, 1, 25, 's', 'ended-early'),
    fixtureEntry('hour-long', hourDay, 10, 0, 65, 90, LONG_LOG_TASK, 'completed'),
    fixtureEntry('older-plan', earlier, 11, 0, 25, 25, 'plan the week', 'completed'),
  ];
}

export function getFocusLogChartFixture(now: Date = new Date()): FocusLogEntry[] {
  const today = startOfLocalDay(now);
  return [
    ...getFocusLogRedesignFixture(now),
    fixtureEntry('today-chart', today, 9, 0, 25, 25, 'morning pages', 'completed'),
    fixtureEntry('d5', addDays(now, -5), 10, 0, 50, 50, 'write the spec', 'completed'),
    fixtureEntry('d8', addDays(now, -8), 14, 0, 40, 50, 'review pr', 'ended-early'),
    fixtureEntry('d12', addDays(now, -12), 11, 0, 90, 90, 'Production Agent Lab', 'completed'),
  ];
}
