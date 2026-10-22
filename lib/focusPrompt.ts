import { DayModel, DEFAULT_FOCUS_MINUTES } from './day';
import { formatCompactDuration } from './tab';

export const ASK_PROMPT = "What's the one thing?";
export const END_EARLY_PROMPT = 'End focus early?';
export const END_SESSION_PROMPT = 'End session?';
export const END_SESSION_LABEL = 'End session';
export const KEEP_RESTING_LABEL = 'Keep resting';
export const KEEP_FOCUSING_LABEL = 'Keep focusing';
export const KEEP_GOING_LABEL = 'Keep going';
export const END_LABEL = 'End';
export const START_LABEL = 'Start';
export const TAKE_BREAK_LABEL = 'Take a break';
export const ANOTHER_ROUND_LABEL = 'Start another';
export const DONE_LABEL = 'Done';
export const UNTIL_MEETING_LABEL = 'Until next meeting';
export const JOIN_LABEL = 'Join';
export const SKIP_LABEL = 'Skip';
export const MENU_ASK_HINT = '← → to choose, Enter to start';
export const FALLBACK_TASK = 'Focus';
export const BREAK_MINUTES = 5;
export const DURATION_CHIPS = [25, 50, 90] as const;
export const RECENT_TASKS_KEY = 'focusOrb:recentTasks';
export const LAST_DURATION_KEY = 'focusOrb:lastDuration';
export const LAST_TASK_KEY = 'focusOrb:lastTask';
export const MAX_RECENT_TASKS = 5;
export const MAX_ASK_SUGGESTIONS = 3;

export type DurationChoice = number | 'until';
export type PromptSurface =
  | 'ask'
  | 'focusing'
  | 'stop-confirm'
  | 'session-confirm'
  | 'completed'
  | 'break'
  | 'meeting-soon'
  | 'in-meeting';

export function rememberTask(task: string, existing: string[] = []): string[] {
  const trimmed = task.trim();
  if (!trimmed || trimmed === FALLBACK_TASK) {
    return existing.slice(0, MAX_RECENT_TASKS);
  }
  return [trimmed, ...existing.filter((item) => item !== trimmed)].slice(
    0,
    MAX_RECENT_TASKS
  );
}

export function loadRecentTasks(): string[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(RECENT_TASKS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === 'string').slice(0, MAX_RECENT_TASKS);
  } catch {
    return [];
  }
}

export function saveRecentTasks(tasks: string[]): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(RECENT_TASKS_KEY, JSON.stringify(tasks.slice(0, MAX_RECENT_TASKS)));
}

export function loadLastTask(): string {
  if (typeof localStorage === 'undefined') return '';
  return localStorage.getItem(LAST_TASK_KEY) ?? '';
}

export function saveLastTask(task: string): void {
  if (typeof localStorage === 'undefined') return;
  const trimmed = task.trim();
  if (!trimmed) localStorage.removeItem(LAST_TASK_KEY);
  else localStorage.setItem(LAST_TASK_KEY, trimmed);
}

export function visibleAskSuggestions(
  recent: string[],
  _typed: string = '',
  limit: number = MAX_ASK_SUGGESTIONS
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of recent) {
    const name = item.trim();
    if (!name || name === FALLBACK_TASK) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
    if (out.length >= limit) break;
  }
  return out;
}

export function suggestionMatchesInput(name: string, typed: string): boolean {
  const current = typed.trim().toLowerCase();
  return Boolean(current) && name.trim().toLowerCase() === current;
}

export function resolveStartTask(
  typed: string,
  lastTask: string,
  recent: string[] = []
): string {
  const fromInput = typed.trim();
  if (fromInput) return fromInput;
  const last = lastTask.trim();
  if (last) return last;
  const fromRecent = recent.find((item) => item.trim());
  if (fromRecent) return fromRecent.trim();
  return FALLBACK_TASK;
}

export function loadLastDuration(): DurationChoice | null {
  if (typeof localStorage === 'undefined') return null;
  const raw = localStorage.getItem(LAST_DURATION_KEY);
  if (raw === 'until') return 'until';
  if (!raw) return null;
  const minutes = Number(raw);
  if (!Number.isFinite(minutes) || minutes <= 0) return null;
  return minutes;
}

export function saveLastDuration(choice: DurationChoice): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(LAST_DURATION_KEY, String(choice));
}

export function untilMeetingDuration(model: DayModel): number | null {
  if (!model.nextEvent || model.gapMinutes == null) return null;
  const minutes = Math.floor(model.gapMinutes);
  if (minutes < 1) return null;
  return minutes;
}

export function capDuration(minutes: number, untilMinutes: number | null): number {
  const safe = Math.max(1, Math.floor(minutes));
  if (untilMinutes == null) return safe;
  return Math.max(1, Math.min(safe, untilMinutes));
}

export function resolveDuration(
  choice: DurationChoice | null,
  untilMinutes: number | null
): number {
  if (choice === 'until') {
    return untilMinutes ?? DEFAULT_FOCUS_MINUTES;
  }
  if (typeof choice === 'number') {
    return capDuration(choice, untilMinutes);
  }
  return capDuration(DEFAULT_FOCUS_MINUTES, untilMinutes);
}

export function formatCompleted(
  minutes: number,
  task: string,
  planned: number = minutes
): string {
  const label = task.trim() || FALLBACK_TASK;
  const spent = Math.max(1, Math.round(minutes));
  const total = Math.max(spent, Math.round(planned));
  return `Focused ${spent} of ${total} min on ${label}`;
}

export function remainingMinutes(minutesLeft: number): number {
  if (minutesLeft <= 0) return 0;
  return Math.max(1, Math.ceil(minutesLeft - 1e-9));
}

export function formatFocusingCopy(task: string, minutesLeft: number): {
  task: string;
  countdown: string;
} {
  return {
    task: task.trim() || FALLBACK_TASK,
    countdown: `${formatCompactDuration(remainingMinutes(minutesLeft))} left`,
  };
}

export function formatBreakCopy(minutesLeft: number): string {
  return `Break ${formatCompactDuration(remainingMinutes(minutesLeft))}`;
}

export function formatMeetingSoonCopy(minutes: number): string {
  return `Meeting in ${Math.max(1, Math.ceil(minutes))}m`;
}

export function shortTask(task: string, max = 16): string {
  const trimmed = task.trim() || FALLBACK_TASK;
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

export function formatMiniFocusStatus(input: {
  surface: PromptSurface | null;
  task?: string;
  minutes?: number | null;
}): string | null {
  if (input.surface === 'stop-confirm') return 'End early?';
  if (input.surface === 'session-confirm') return 'End session?';
  if (input.surface === 'break' && input.minutes != null) {
    return formatBreakCopy(input.minutes);
  }
  if (input.surface === 'focusing' && input.minutes != null) {
    return `${shortTask(input.task || FALLBACK_TASK)} ${formatCompactDuration(remainingMinutes(input.minutes))}`;
  }
  return null;
}

export function promptSurface(input: {
  firstOpen?: boolean;
  miniOnly?: boolean;
  isFocusing: boolean;
  isBreak: boolean;
  stopConfirm: boolean;
  sessionConfirm?: boolean;
  completed: boolean;
  headsUp: boolean;
  skipHeadsUp?: boolean;
  dayState: DayModel['state'];
}): PromptSurface | null {
  if (input.firstOpen || input.miniOnly) return null;
  if (input.isFocusing && input.stopConfirm) return 'stop-confirm';
  if ((input.isFocusing || input.isBreak) && input.sessionConfirm) return 'session-confirm';
  if (input.isFocusing) return 'focusing';
  if (input.isBreak) return 'break';
  if (input.completed) return 'completed';
  if (input.dayState === 'in-meeting' || input.dayState === 'in-run') {
    return 'in-meeting';
  }
  if (input.headsUp && !input.skipHeadsUp) return 'meeting-soon';
  return 'ask';
}

