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

export const WHOOP_MODE_HINTS: Record<WhoopMode, string> = {
  off: 'Keeps WHOOP connected without changing home.',
  suggest: 'Offers a quiet length. You still start.',
  adapt: 'Pre-fills the WHOOP length and break.',
};

export function whoopOfferLabel(minutes: number): string {
  return `${minutes}m today`;
}

export const WHOOP_APP_URL = 'https://app.whoop.com';
export const WHOOP_PEAK_START_HOURS = 2;
export const WHOOP_PEAK_END_HOURS = 6;
export const WHOOP_WINDOW_MIN_MINUTES = 60;

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
export const WHOOP_CONNECT_LABEL = 'Connect WHOOP';
export const WHOOP_RECONNECT_LABEL = 'Reconnect WHOOP';
export const WHOOP_DISCONNECT_LABEL = 'Disconnect';
export const WHOOP_SHOW_NUMBERS_LABEL = 'Show numbers';
export const WHOOP_SECTION_LABEL = 'WHOOP';
export const WHOOP_PENDING_LINE = 'Recovery not ready yet.';
export const WHOOP_REVOKE_APP_LABEL = 'Remove Focus Orb in the WHOOP app.';
export const WHOOP_INVITE_ONLY_MESSAGE = 'WHOOP is invite-only during beta.';
export const WHOOP_DEVICES_NOTE = 'Each device connects separately.';
export const WHOOP_CONSENT_COPY =
  'WHOOP reads your recovery, sleep, and cycles. Those numbers stay in this browser. Focus Orb does not keep a database of them. The cookie holds only the sign-in tokens, not your scores. Disconnect in Settings to revoke access and delete the cookie.';
export const WHOOP_CONSENT_CHECK = 'I understand and want to connect WHOOP';

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
  | 'error'
  | 'reconnect';

export interface WhoopFacts {
  recovery: number | null;
  recoveryState: WhoopRecoveryState;
  sleepPerformance: number | null;
  sleepMinutes: number | null;
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
  message?: string;
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

export function formatSleepDuration(totalMinutes: number): string {
  const rounded = Math.max(0, Math.round(totalMinutes));
  const hours = Math.floor(rounded / 60);
  const minutes = rounded % 60;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

function qualitativeRecovery(band: 'green' | 'yellow' | 'red'): string {
  if (band === 'green') return 'Recovery is strong';
  if (band === 'yellow') return 'Recovery is okay';
  return 'Recovery is low';
}

function qualitativeSleep(sleepMinutes: number): string {
  if (sleepMinutes < 6 * 60) return 'sleep was short';
  if (sleepMinutes < 7 * 60) return 'sleep was fair';
  return 'sleep was solid';
}

function qualitativeBlocks(minutes: number): string {
  if (minutes <= 25) return 'shorter blocks';
  if (minutes <= 35) return 'lighter blocks';
  if (minutes <= 45) return 'steady blocks';
  return 'full blocks';
}

export function whoopWhyLine(
  facts: WhoopFacts | null,
  blockMinutes: number | null,
  showNumbers: boolean
): string | null {
  if (!facts) return null;
  if (facts.recoveryState === 'pending' || facts.recoveryState === 'calibrating') {
    return WHOOP_PENDING_LINE;
  }

  const parts: string[] = [];
  if (showNumbers) {
    if (facts.recovery != null) parts.push(`Recovery ${Math.round(facts.recovery)}%`);
    if (facts.sleepMinutes != null) {
      const slept = `slept ${formatSleepDuration(facts.sleepMinutes)}`;
      parts.push(
        facts.sleepPerformance != null ? `${slept} (${Math.round(facts.sleepPerformance)}%)` : slept
      );
    }
  } else {
    const band = facts.recovery != null ? recoveryBand(facts.recovery) : null;
    if (band) parts.push(qualitativeRecovery(band));
    if (facts.sleepMinutes != null) parts.push(qualitativeSleep(facts.sleepMinutes));
  }

  const so =
    blockMinutes != null
      ? showNumbers
        ? `so ${blockMinutes}m blocks today`
        : `so ${qualitativeBlocks(blockMinutes)} today`
      : null;

  if (parts.length === 0) {
    return whoopQuietLine(whoopLineKey(detectWhoopStates(facts)), facts, showNumbers);
  }
  if (so) return `${parts.join(', ')}, ${so}.`;
  return `${parts.join(', ')}.`;
}

export interface WhoopWindowGap {
  start: Date;
  end: Date | null;
}

function hourParts(date: Date): { hour: number; minutes: number; meridiem: 'AM' | 'PM' } {
  const hours = date.getHours();
  return {
    hour: hours % 12 || 12,
    minutes: date.getMinutes(),
    meridiem: hours >= 12 ? 'PM' : 'AM',
  };
}

function formatHourPart(parts: { hour: number; minutes: number; meridiem: 'AM' | 'PM' }): string {
  const clock = parts.minutes ? `${parts.hour}:${String(parts.minutes).padStart(2, '0')}` : `${parts.hour}`;
  return `${clock} ${parts.meridiem}`;
}

export function formatHourRange(start: Date, end: Date): string {
  const a = hourParts(start);
  const b = hourParts(end);
  if (a.meridiem === b.meridiem && a.minutes === 0 && b.minutes === 0 && a.hour !== 12) {
    return `${a.hour} to ${b.hour} ${b.meridiem}`;
  }
  return `${formatHourPart(a)} to ${formatHourPart(b)}`;
}

export function formatWhoopWindow(start: Date, end: Date): string {
  return `Best focus window ${formatHourRange(start, end)}.`;
}

export function whoopBestWindow(
  facts: WhoopFacts,
  gaps: WhoopWindowGap[],
  now: Date = new Date(facts.now)
): { start: Date; end: Date } | null {
  if (facts.wakeAt == null || gaps.length === 0) return null;
  const peakStart = facts.wakeAt + WHOOP_PEAK_START_HOURS * 60 * 60 * 1000;
  const peakEnd = facts.wakeAt + WHOOP_PEAK_END_HOURS * 60 * 60 * 1000;
  const nowMs = now.getTime();
  let best: { start: Date; end: Date; minutes: number } | null = null;
  for (const gap of gaps) {
    const gapEndMs = gap.end ? gap.end.getTime() : endOfLocalDay(now).getTime();
    const startMs = Math.max(gap.start.getTime(), peakStart, nowMs);
    const endMs = Math.min(gapEndMs, peakEnd);
    const minutes = (endMs - startMs) / 60_000;
    if (minutes < WHOOP_WINDOW_MIN_MINUTES) continue;
    if (!best || minutes > best.minutes) {
      best = { start: new Date(startMs), end: new Date(endMs), minutes };
    }
  }
  return best ? { start: best.start, end: best.end } : null;
}

function endOfLocalDay(now: Date): Date {
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  return end;
}

export function suggestWhoop(
  facts: WhoopFacts,
  showNumbers: boolean,
  usual: WhoopRhythm = WHOOP_USUAL
): WhoopSuggestion {
  const states = detectWhoopStates(facts);
  const lineKey = whoopLineKey(states);
  const rhythm = combineWhoopRhythms(states, usual);
  return {
    rhythm,
    states,
    lineKey,
    line: whoopWhyLine(facts, rhythm.firstBlockMinutes, showNumbers),
  };
}

export function whoopSettingsStatus(status: WhoopConnectionStatus): string | null {
  if (status === 'disconnected') return WHOOP_DISCONNECTED_LABEL;
  if (status === 'reconnect') return WHOOP_RECONNECT_LABEL;
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
