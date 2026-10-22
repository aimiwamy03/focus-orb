export const WHOOP_USUAL = {
  firstBlockMinutes: 50,
  blockMinutes: 50,
  breakMinutes: 10,
  blocks: 4,
} as const;

export const WHOOP_MODES = ['off', 'suggest', 'adapt'] as const;
export type WhoopMode = (typeof WHOOP_MODES)[number];

export const WHOOP_MODE_LABELS: Record<WhoopMode, string> = {
  off: 'Off',
  suggest: 'Suggest only',
  adapt: 'Adapt defaults',
};

export const DEFAULT_WHOOP_MODE: WhoopMode = 'suggest';

export const WHOOP_STATES = [
  'green',
  'yellow',
  'red',
  'sleep',
  'debt',
  'strain',
  'workout',
  'late',
  'pending',
] as const;

export type WhoopState = (typeof WHOOP_STATES)[number];

export const WHOOP_LINE_PRIORITY: WhoopState[] = [
  'workout',
  'red',
  'sleep',
  'debt',
  'strain',
  'late',
  'yellow',
  'green',
];

export const WHOOP_RECOVERY_GREEN = 67;
export const WHOOP_RECOVERY_YELLOW = 34;
export const WHOOP_SLEEP_POOR = 70;
export const WHOOP_DEBT_MINUTES = 45;
export const WHOOP_STRAIN_HARD = 14;
export const WHOOP_WORKOUT_MINUTES = 45;
export const WHOOP_LATE_HOURS = 10;
export const WHOOP_LATE_HOUR_FALLBACK = 18;
export const WHOOP_NUDGE_LIMIT = 3;
export const WHOOP_SUMMARY_TTL_MS = 15 * 60_000;
export const WHOOP_REFRESH_SKEW_MS = 5 * 60_000;
export const WHOOP_SCOPES = 'read:recovery read:sleep read:cycles read:workout offline';

export const WHOOP_MODE_KEY = 'focusOrb:whoopMode';
export const WHOOP_NUMBERS_KEY = 'focusOrb:whoopShowNumbers';
export const WHOOP_HIDE_LINE_KEY = 'focusOrb:whoopHideLine';
export const WHOOP_SUMMARY_KEY = 'focusOrb:whoopSummary';
export const WHOOP_NUDGE_KEY = 'focusOrb:whoopNudges';

export const WHOOP_DISCONNECTED_LABEL = 'WHOOP disconnected';
export const WHOOP_NO_DATA_LABEL = 'No WHOOP data today';
export const WHOOP_LEARNING_LABEL = 'WHOOP is still learning you';
export const WHOOP_CONNECT_LABEL = 'Connect';
export const WHOOP_RECONNECT_LABEL = 'Reconnect';
export const WHOOP_DISCONNECT_LABEL = 'Disconnect';
export const WHOOP_SHOW_NUMBERS_LABEL = 'Show numbers';
export const WHOOP_SECTION_LABEL = 'WHOOP';
export const WHOOP_PENDING_LINE = 'Recovery not ready yet.';

export type WhoopRecoveryState =
  | 'scored'
  | 'pending'
  | 'unscorable'
  | 'missing'
  | 'calibrating';

export type WhoopConnectionStatus =
  | 'disconnected'
  | 'ok'
  | 'pending'
  | 'no-data'
  | 'calibrating'
  | 'error';

export interface WhoopFacts {
  recovery: number | null;
  recoveryState: WhoopRecoveryState;
  sleepPerformance: number | null;
  sleepDebtMinutes: number | null;
  yesterdayStrain: number | null;
  lastWorkoutEndedAt: number | null;
  wakeAt: number | null;
  now: number;
}

export interface WhoopRhythm {
  firstBlockMinutes: number;
  blockMinutes: number;
  breakMinutes: number;
  blocks: number;
}

export interface WhoopSuggestion {
  rhythm: WhoopRhythm;
  states: WhoopState[];
  lineKey: WhoopState | null;
  line: string | null;
}

export interface WhoopCachedSummary {
  connected: boolean;
  email: string | null;
  status: WhoopConnectionStatus;
  facts: WhoopFacts | null;
  fetchedAt: number;
}

export interface WhoopNudgeRecord {
  day: string;
  key: WhoopState | 'none';
  ignores: number;
}

export function isWhoopMode(value: string | null | undefined): value is WhoopMode {
  return !!value && (WHOOP_MODES as readonly string[]).includes(value);
}

export function recoveryStateFromWhoop(
  scoreState: string | null | undefined,
  calibrating?: boolean
): WhoopRecoveryState {
  if (calibrating) return 'calibrating';
  if (!scoreState) return 'missing';
  if (scoreState === 'PENDING_SCORE') return 'pending';
  if (scoreState === 'UNSCORABLE') return 'unscorable';
  if (scoreState === 'SCORED') return 'scored';
  return 'missing';
}

export function recoveryBand(score: number | null): 'green' | 'yellow' | 'red' | null {
  if (score == null || !Number.isFinite(score)) return null;
  if (score >= WHOOP_RECOVERY_GREEN) return 'green';
  if (score >= WHOOP_RECOVERY_YELLOW) return 'yellow';
  if (score >= 0) return 'red';
  return null;
}

export function isLateDay(wakeAt: number | null, nowMs: number): boolean {
  if (wakeAt != null && Number.isFinite(wakeAt)) {
    return nowMs - wakeAt >= WHOOP_LATE_HOURS * 60 * 60 * 1000;
  }
  return new Date(nowMs).getHours() >= WHOOP_LATE_HOUR_FALLBACK;
}

export function justWorkedOut(lastWorkoutEndedAt: number | null, nowMs: number): boolean {
  if (lastWorkoutEndedAt == null) return false;
  const ago = nowMs - lastWorkoutEndedAt;
  return ago >= 0 && ago <= WHOOP_WORKOUT_MINUTES * 60_000;
}

export function detectWhoopStates(facts: WhoopFacts): WhoopState[] {
  if (facts.recoveryState === 'calibrating') return ['pending'];

  const states: WhoopState[] = [];
  if (justWorkedOut(facts.lastWorkoutEndedAt, facts.now)) states.push('workout');

  if (facts.recoveryState === 'scored') {
    const band = recoveryBand(facts.recovery);
    if (band) states.push(band);
  } else if (facts.recoveryState === 'pending') {
    states.push('pending');
  }

  if (facts.sleepPerformance != null && facts.sleepPerformance < WHOOP_SLEEP_POOR) {
    states.push('sleep');
  }
  if (facts.sleepDebtMinutes != null && facts.sleepDebtMinutes >= WHOOP_DEBT_MINUTES) {
    states.push('debt');
  }
  if (facts.yesterdayStrain != null && facts.yesterdayStrain >= WHOOP_STRAIN_HARD) {
    states.push('strain');
  }
  if (isLateDay(facts.wakeAt, facts.now)) states.push('late');

  return states;
}

export function rhythmForState(
  state: WhoopState,
  usual: WhoopRhythm = WHOOP_USUAL
): WhoopRhythm {
  switch (state) {
    case 'green':
      return { firstBlockMinutes: 50, blockMinutes: 50, breakMinutes: 10, blocks: 4 };
    case 'yellow':
      return { firstBlockMinutes: 40, blockMinutes: 40, breakMinutes: 8, blocks: 4 };
    case 'red':
      return { firstBlockMinutes: 25, blockMinutes: 25, breakMinutes: 5, blocks: 3 };
    case 'sleep':
      return {
        firstBlockMinutes: 30,
        blockMinutes: usual.blockMinutes,
        breakMinutes: 8,
        blocks: 3,
      };
    case 'debt':
      return { firstBlockMinutes: 30, blockMinutes: 30, breakMinutes: 10, blocks: 3 };
    case 'strain':
      return {
        firstBlockMinutes: usual.firstBlockMinutes,
        blockMinutes: usual.blockMinutes,
        breakMinutes: usual.breakMinutes + 5,
        blocks: Math.max(1, usual.blocks - 1),
      };
    case 'workout':
      return {
        firstBlockMinutes: 20,
        blockMinutes: usual.blockMinutes,
        breakMinutes: 5,
        blocks: usual.blocks,
      };
    case 'late':
      return { firstBlockMinutes: 25, blockMinutes: 25, breakMinutes: 5, blocks: 2 };
    case 'pending':
      return { ...usual };
  }
}

export function combineWhoopRhythms(
  states: WhoopState[],
  usual: WhoopRhythm = WHOOP_USUAL
): WhoopRhythm {
  const active = states.filter((state) => state !== 'pending');
  if (active.length === 0) return { ...usual };

  const rhythms = active.map((state) => rhythmForState(state, usual));
  return {
    firstBlockMinutes: Math.min(...rhythms.map((item) => item.firstBlockMinutes)),
    blockMinutes: Math.min(...rhythms.map((item) => item.blockMinutes)),
    breakMinutes: Math.max(...rhythms.map((item) => item.breakMinutes)),
    blocks: Math.min(...rhythms.map((item) => item.blocks)),
  };
}

export function whoopLineKey(states: WhoopState[]): WhoopState | null {
  for (const key of WHOOP_LINE_PRIORITY) {
    if (states.includes(key)) return key;
  }
  return states.includes('pending') ? 'pending' : null;
}

function recoveryWords(band: 'green' | 'yellow' | 'red'): string {
  if (band === 'green') return 'Good day for deep work.';
  if (band === 'yellow') return 'Steady blocks today.';
  return 'Low recovery day.';
}

export function whoopQuietLine(
  key: WhoopState | null,
  facts: WhoopFacts | null,
  showNumbers: boolean
): string | null {
  if (!key) return null;
  const recovery = facts?.recovery;
  const sleep = facts?.sleepPerformance;
  switch (key) {
    case 'green':
      return showNumbers && recovery != null
        ? `Recovery ${Math.round(recovery)}%. Good day for deep work.`
        : recoveryWords('green');
    case 'yellow':
      return showNumbers && recovery != null
        ? `Recovery ${Math.round(recovery)}%. Steady blocks today.`
        : recoveryWords('yellow');
    case 'red':
      return showNumbers && recovery != null
        ? `Recovery ${Math.round(recovery)}%. Shorter blocks today.`
        : recoveryWords('red');
    case 'sleep':
      return showNumbers && sleep != null
        ? `Sleep ${Math.round(sleep)}%. Start with something light.`
        : 'Start with something light.';
    case 'debt':
      return 'Short on sleep. Take real breaks today.';
    case 'strain':
      return 'Big day yesterday. Pace yourself.';
    case 'workout':
      return 'Fresh off a workout. Ease in with 20 minutes.';
    case 'late':
      return 'Late in your day. One short block?';
    case 'pending':
      return WHOOP_PENDING_LINE;
  }
}

export function suggestWhoop(
  facts: WhoopFacts,
  showNumbers: boolean,
  usual: WhoopRhythm = WHOOP_USUAL
): WhoopSuggestion {
  const states = detectWhoopStates(facts);
  const lineKey = whoopLineKey(states);
  return {
    rhythm: combineWhoopRhythms(states, usual),
    states,
    lineKey,
    line: whoopQuietLine(lineKey, facts, showNumbers),
  };
}

export function whoopSettingsStatus(status: WhoopConnectionStatus): string | null {
  if (status === 'disconnected') return WHOOP_DISCONNECTED_LABEL;
  if (status === 'no-data') return WHOOP_NO_DATA_LABEL;
  if (status === 'calibrating') return WHOOP_LEARNING_LABEL;
  return null;
}

export function cycleWhoopMode(mode: WhoopMode, dir: 1 | -1): WhoopMode {
  const index = WHOOP_MODES.indexOf(mode);
  const next = (index + dir + WHOOP_MODES.length) % WHOOP_MODES.length;
  return WHOOP_MODES[next];
}

export function localDayKey(nowMs: number = Date.now()): string {
  const date = new Date(nowMs);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function loadWhoopMode(): WhoopMode {
  if (typeof localStorage === 'undefined') return DEFAULT_WHOOP_MODE;
  const raw = localStorage.getItem(WHOOP_MODE_KEY);
  return isWhoopMode(raw) ? raw : DEFAULT_WHOOP_MODE;
}

export function saveWhoopMode(mode: WhoopMode): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(WHOOP_MODE_KEY, mode);
}

export function loadWhoopShowNumbers(): boolean {
  if (typeof localStorage === 'undefined') return true;
  const raw = localStorage.getItem(WHOOP_NUMBERS_KEY);
  if (raw == null) return true;
  return raw !== '0';
}

export function saveWhoopShowNumbers(show: boolean): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(WHOOP_NUMBERS_KEY, show ? '1' : '0');
}

export function isWhoopLineHidden(nowMs: number = Date.now()): boolean {
  if (typeof localStorage === 'undefined') return false;
  return localStorage.getItem(WHOOP_HIDE_LINE_KEY) === localDayKey(nowMs);
}

export function hideWhoopLineForToday(nowMs: number = Date.now()): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(WHOOP_HIDE_LINE_KEY, localDayKey(nowMs));
}

export function loadWhoopNudge(nowMs: number = Date.now()): WhoopNudgeRecord | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(WHOOP_NUDGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WhoopNudgeRecord;
    if (parsed.day !== localDayKey(nowMs)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function recordWhoopNudge(
  lineKey: WhoopState | null,
  usedMinutes: number,
  suggestedMinutes: number,
  nowMs: number = Date.now()
): WhoopNudgeRecord {
  const day = localDayKey(nowMs);
  const key = lineKey ?? 'none';
  const previous = loadWhoopNudge(nowMs);
  const sameKind = previous && previous.day === day && previous.key === key;
  const ignored = usedMinutes !== suggestedMinutes;
  const next: WhoopNudgeRecord = {
    day,
    key,
    ignores: ignored ? (sameKind ? previous.ignores + 1 : 1) : 0,
  };
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(WHOOP_NUDGE_KEY, JSON.stringify(next));
  }
  return next;
}

export function shouldStopWhoopNudge(
  lineKey: WhoopState | null,
  nowMs: number = Date.now()
): boolean {
  const record = loadWhoopNudge(nowMs);
  if (!record) return false;
  return record.key === (lineKey ?? 'none') && record.ignores >= WHOOP_NUDGE_LIMIT;
}

export function loadCachedWhoopSummary(): WhoopCachedSummary | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(WHOOP_SUMMARY_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as WhoopCachedSummary;
  } catch {
    return null;
  }
}

export function saveCachedWhoopSummary(summary: WhoopCachedSummary): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(WHOOP_SUMMARY_KEY, JSON.stringify(summary));
}

export function clearCachedWhoopSummary(): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(WHOOP_SUMMARY_KEY);
}

export function cachedSummaryIsFresh(
  summary: WhoopCachedSummary | null,
  nowMs: number = Date.now()
): boolean {
  if (!summary) return false;
  return nowMs - summary.fetchedAt < WHOOP_SUMMARY_TTL_MS;
}
