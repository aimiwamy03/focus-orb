import { formatDayFocused, type FocusLogEnded, type FocusLogEntry } from './focusLog';
import { breathGlow, breathPhase, breathScale } from './miniOrb';

export const ORB_GROWTH_MIN_COUNTED = 15;

export const ORB_SETTLE_MS = 75_000;
export const ORB_SETTLE_MIN_MS = 60_000;
export const ORB_SETTLE_MAX_MS = 90_000;
export const ORB_SETTLE_IN_MS = 4_000;
export const ORB_SETTLE_OUT_MS = 6_000;
export const ORB_SETTLE_CYCLE_MS = ORB_SETTLE_IN_MS + ORB_SETTLE_OUT_MS;
export const ORB_SETTLE_BREATHS_PER_MIN = 60_000 / ORB_SETTLE_CYCLE_MS;
export const ORB_SETTLE_BREATH = 0.08;
export const ORB_FOCUS_DRIFT = 0.003;

export const ORB_BLOOM_MS = 2_500;
export const ORB_BLOOM_MIN_MS = 2_000;
export const ORB_BLOOM_MAX_MS = 3_000;

export const SETTLE_SESSION_KEY = 'focusOrb:settlePlayed';
export const SETTLE_SKIP_HINT = 'Esc to skip';
export const ONE_THING_PROMPT = "What's the one thing?";
export const NEXT_STEP_LABEL = 'Where did you stop, and what is next?';
export const NEXT_STEP_PLACEHOLDER = 'A note for later';
export const RATING_PROMPT = 'How was your focus?';
export const IDLE_BREATH_STEP = 0.008;
export const IDLE_BREATH_FREQ = 0.45;
export const IDLE_BREATH_AMP_GATHERED = 0.05;
export const IDLE_BREATH_AMP_SCATTERED = 0.03;
export const IDLE_BREATH_SCATTER_TIGHT = 0.05;

export const ORB_STAGE_KEYS = [
  'cluster',
  'gathering',
  'forming',
  'full',
  'radiant',
] as const;

export type OrbStageKey = (typeof ORB_STAGE_KEYS)[number];
export type OrbMoment = 'still' | 'settle' | 'focusing' | 'bloom';
export type OrbPreviewKey = OrbStageKey | 'settle' | 'bloom';

export const ORB_PREVIEW_KEYS = [...ORB_STAGE_KEYS, 'settle', 'bloom'] as const;

export interface OrbLook {
  scale: number;
  tightness: number;
  brightness: number;
  glow: number;
  halo: number;
  warmth: number;
}

export interface OrbStage {
  id: number;
  key: OrbStageKey;
  name: string;
  minMinutes: number;
  look: OrbLook;
}

/** Single tunable config for the 15-person test. */
export const ORB_GROWTH = {
  minCountedMinutes: ORB_GROWTH_MIN_COUNTED,
  settleMs: ORB_SETTLE_MS,
  settleInMs: ORB_SETTLE_IN_MS,
  settleOutMs: ORB_SETTLE_OUT_MS,
  bloomMs: ORB_BLOOM_MS,
  stages: [
    {
      id: 0,
      key: 'cluster',
      name: 'Cluster',
      minMinutes: 0,
      look: { scale: 0.42, tightness: 0.52, brightness: 0.58, glow: 0.08, halo: 0, warmth: 0 },
    },
    {
      id: 1,
      key: 'gathering',
      name: 'Gathering',
      minMinutes: 45,
      look: { scale: 0.62, tightness: 0.74, brightness: 0.74, glow: 0.18, halo: 0, warmth: 0.08 },
    },
    {
      id: 2,
      key: 'forming',
      name: 'Forming',
      minMinutes: 90,
      look: { scale: 0.82, tightness: 0.9, brightness: 0.9, glow: 0.32, halo: 0, warmth: 0.2 },
    },
    {
      id: 3,
      key: 'full',
      name: 'Full orb',
      minMinutes: 150,
      look: { scale: 1, tightness: 1, brightness: 1, glow: 0.4, halo: 0, warmth: 0.08 },
    },
    {
      id: 4,
      key: 'radiant',
      name: 'Radiant',
      minMinutes: 240,
      look: { scale: 1, tightness: 1, brightness: 1, glow: 0.55, halo: 1, warmth: 0.12 },
    },
  ] satisfies OrbStage[],
} as const;

export const ORB_STAGES: readonly OrbStage[] = ORB_GROWTH.stages;

export const ORB_PREVIEW_MINUTES: Record<OrbStageKey, number> = {
  cluster: 0,
  gathering: 45,
  forming: 90,
  full: 150,
  radiant: 240,
};

export const ORB_BLOOM_PREVIEW_BEFORE = 80;
export const ORB_BLOOM_PREVIEW_SESSION = 25;

export function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function easeInOut(value: number): number {
  const x = clamp01(value);
  return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
}

export function isOrbPreviewKey(value: string | null): value is OrbPreviewKey {
  return !!value && (ORB_PREVIEW_KEYS as readonly string[]).includes(value);
}

export function isOrbStageKey(value: string | null): value is OrbStageKey {
  return !!value && (ORB_STAGE_KEYS as readonly string[]).includes(value);
}

export function parseOrbFreeze(raw: string | null): number | null {
  if (raw == null || raw === '') return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

export function stageForMinutes(minutes: number): OrbStage {
  const counted = Math.max(0, minutes);
  let current = ORB_STAGES[0];
  for (const stage of ORB_STAGES) {
    if (counted >= stage.minMinutes) current = stage;
  }
  return current;
}

export function stageByKey(key: OrbStageKey): OrbStage {
  return ORB_STAGES.find((stage) => stage.key === key) ?? ORB_STAGES[0];
}

export function stageById(id: number): OrbStage {
  return ORB_STAGES.find((stage) => stage.id === id) ?? ORB_STAGES[0];
}

export function mixLooks(from: OrbLook, to: OrbLook, t: number): OrbLook {
  const p = clamp01(t);
  return {
    scale: from.scale + (to.scale - from.scale) * p,
    tightness: from.tightness + (to.tightness - from.tightness) * p,
    brightness: from.brightness + (to.brightness - from.brightness) * p,
    glow: from.glow + (to.glow - from.glow) * p,
    halo: from.halo + (to.halo - from.halo) * p,
    warmth: from.warmth + (to.warmth - from.warmth) * p,
  };
}

export function lookForStage(stage: OrbStage | OrbStageKey | number): OrbLook {
  if (typeof stage === 'number') return stageById(stage).look;
  if (typeof stage === 'string') return stageByKey(stage).look;
  return stage.look;
}

export function settleBreathScale(elapsedMs: number, reducedMotion = false): number {
  if (reducedMotion) return 1;
  const cycle = ORB_SETTLE_CYCLE_MS;
  const t = ((elapsedMs % cycle) + cycle) % cycle;
  if (t < ORB_SETTLE_IN_MS) {
    return 1 + ORB_SETTLE_BREATH * easeInOut(t / ORB_SETTLE_IN_MS);
  }
  return 1 + ORB_SETTLE_BREATH * (1 - easeInOut((t - ORB_SETTLE_IN_MS) / ORB_SETTLE_OUT_MS));
}

export function bloomProgress(elapsedMs: number, reducedMotion = false): number {
  if (elapsedMs <= 0) return 0;
  if (reducedMotion) return 1;
  return easeInOut(elapsedMs / ORB_BLOOM_MS);
}

export function bloomLook(
  from: OrbLook,
  to: OrbLook,
  elapsedMs: number,
  reducedMotion = false,
  crossed = true
): OrbLook {
  if (!crossed) {
    const pulse = reducedMotion ? 0 : 0.16 * Math.sin(clamp01(elapsedMs / ORB_BLOOM_MS) * Math.PI);
    return { ...from, glow: from.glow + pulse };
  }
  if (reducedMotion) {
    return elapsedMs > 0 ? to : from;
  }
  return mixLooks(from, to, bloomProgress(elapsedMs, false));
}

export function focusDriftScale(elapsedMs: number, reducedMotion = false): number {
  if (reducedMotion) return 1;
  return 1 + Math.sin(elapsedMs / 18_000) * ORB_FOCUS_DRIFT;
}

/** Idle pulse from before #30: `time += 0.008` each frame, then `1 + sin(time * 0.45) * amp`. */
export function idleBreathScale(
  time: number,
  scatter: number,
  reducedMotion = false
): number {
  if (reducedMotion) return 1;
  const amp =
    scatter < IDLE_BREATH_SCATTER_TIGHT
      ? IDLE_BREATH_AMP_GATHERED
      : IDLE_BREATH_AMP_SCATTERED;
  return 1 + Math.sin(time * IDLE_BREATH_FREQ) * amp;
}

/** Original idle/focus pulse, stacked on #30 settle/bloom breath and stage scale. */
export function liveOrbPulse(input: {
  moment: OrbMoment;
  settleOrBloomBreath: number;
  pulseTime: number;
  scatter: number;
  nowMs: number;
  reducedMotion?: boolean;
}): { breath: number; glowBoost: number } {
  const reduced = Boolean(input.reducedMotion);
  if (input.moment === 'settle' || input.moment === 'bloom') {
    return { breath: input.settleOrBloomBreath, glowBoost: 0 };
  }
  if (input.moment === 'focusing') {
    const phase = breathPhase(input.nowMs);
    return {
      breath: breathScale(phase, reduced),
      glowBoost: breathGlow(phase, true),
    };
  }
  return {
    breath: idleBreathScale(input.pulseTime, input.scatter, reduced),
    glowBoost: 0,
  };
}

export function sessionActiveMinutes(input: {
  minutes: number;
  pausedMinutes?: number | null;
}): number {
  return Math.max(0, input.minutes - Math.max(0, input.pausedMinutes ?? 0));
}

export function sessionCounts(input: {
  minutes: number;
  ended: FocusLogEnded;
  pausedMinutes?: number | null;
}): { counted: boolean; minutes: number } {
  const active = sessionActiveMinutes(input);
  if (input.ended === 'completed' || active >= ORB_GROWTH.minCountedMinutes) {
    return { counted: true, minutes: active };
  }
  return { counted: false, minutes: 0 };
}

export function startOfLocalDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

export function isSameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function countedMinutesOnDay(
  entries: FocusLogEntry[],
  day: Date,
  excludeId?: string | null
): number {
  const start = startOfLocalDay(day).getTime();
  const end = start + 86_400_000;
  let total = 0;
  for (const entry of entries) {
    if (excludeId && entry.id === excludeId) continue;
    if (entry.startMs < start || entry.startMs >= end) continue;
    total += sessionCounts(entry).minutes;
  }
  return total;
}

export function countedMinutesToday(
  entries: FocusLogEntry[],
  now: Date = new Date(),
  excludeId?: string | null
): number {
  return countedMinutesOnDay(entries, now, excludeId);
}

export function dayFinalStage(entries: FocusLogEntry[], day: Date): OrbStage | null {
  const start = startOfLocalDay(day).getTime();
  const end = start + 86_400_000;
  const dayEntries = entries
    .filter((entry) => entry.startMs >= start && entry.startMs < end)
    .sort((a, b) => b.endMs - a.endMs);
  if (dayEntries.length === 0) return null;
  const tagged = dayEntries.find((entry) => typeof entry.stageAfter === 'number');
  if (tagged && tagged.stageAfter != null) return stageById(tagged.stageAfter);
  const minutes = countedMinutesOnDay(entries, day);
  return minutes > 0 || dayEntries.some((entry) => sessionCounts(entry).counted)
    ? stageForMinutes(minutes)
    : null;
}

export function formatFocusedToday(minutes: number): string {
  return `${formatDayFocused(Math.max(0, minutes))} focused today.`;
}

export function formatDayStage(stage: OrbStage | null): string | null {
  return stage ? stage.name : null;
}

export function attachGrowthFields(
  draft: Omit<FocusLogEntry, 'id'>,
  input: {
    entries: FocusLogEntry[];
    now?: Date;
    settleSkipped?: boolean;
  }
): Omit<FocusLogEntry, 'id'> {
  const now = input.now ?? new Date(draft.endMs);
  const beforeMinutes = countedMinutesToday(input.entries, now);
  const counted = sessionCounts(draft).minutes;
  const before = stageForMinutes(beforeMinutes);
  const after = stageForMinutes(beforeMinutes + counted);
  return {
    ...draft,
    pausedMinutes: draft.pausedMinutes ?? 0,
    minutesCounted: counted,
    stageBefore: before.id,
    stageAfter: after.id,
    settleSkipped: input.settleSkipped ?? false,
  };
}

export function crossedStage(before: OrbStage | number, after: OrbStage | number): boolean {
  const from = typeof before === 'number' ? before : before.id;
  const to = typeof after === 'number' ? after : after.id;
  return to > from;
}

export function shouldPlaySettle(input: {
  settleParam: string | null;
  preview: OrbPreviewKey | null;
  sessionPlayed: boolean;
  introOpen: boolean;
  focusing: boolean;
  miniOnly: boolean;
  firstOpen: boolean;
}): boolean {
  if (input.miniOnly || input.focusing || input.firstOpen || input.introOpen) return false;
  if (input.preview === 'settle' || input.settleParam === '1') return true;
  if (input.settleParam === '0') return false;
  if (input.preview) return false;
  if (input.sessionPlayed) return false;
  return true;
}

export function loadSettlePlayed(): boolean {
  if (typeof sessionStorage === 'undefined') return false;
  return sessionStorage.getItem(SETTLE_SESSION_KEY) === '1';
}

export function markSettlePlayed(): void {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.setItem(SETTLE_SESSION_KEY, '1');
}

export function isSettleSkipKey(key: string): boolean {
  return key === 'Escape' || key === 'Enter' || key === ' ';
}

export function previewMinutes(preview: OrbPreviewKey | null, fallback = 0): number {
  if (!preview) return fallback;
  if (preview === 'settle') return fallback;
  if (preview === 'bloom') return ORB_BLOOM_PREVIEW_BEFORE + ORB_BLOOM_PREVIEW_SESSION;
  return ORB_PREVIEW_MINUTES[preview];
}

export function resolveDisplayMinutes(input: {
  logMinutes: number;
  preview: OrbPreviewKey | null;
  orbMinutesParam: string | null;
}): number {
  if (input.orbMinutesParam != null && input.orbMinutesParam !== '') {
    const parsed = Number(input.orbMinutesParam);
    if (Number.isFinite(parsed) && parsed >= 0) return parsed;
  }
  if (input.preview && input.preview !== 'settle') {
    return previewMinutes(input.preview, input.logMinutes);
  }
  return input.logMinutes;
}

export interface OrbVisualState {
  moment: OrbMoment;
  stage: OrbStage;
  fromStage: OrbStage;
  toStage: OrbStage;
  minutes: number;
  look: OrbLook;
  breath: number;
  crossed: boolean;
}

export function orbVisualState(input: {
  minutes: number;
  moment: OrbMoment;
  elapsedMs?: number;
  reducedMotion?: boolean;
  fromStage?: OrbStage | null;
  toStage?: OrbStage | null;
  preview?: OrbPreviewKey | null;
}): OrbVisualState {
  const reduced = Boolean(input.reducedMotion);
  const minutes = input.minutes;
  const stage = input.toStage ?? stageForMinutes(minutes);
  const fromStage = input.fromStage ?? stage;
  const toStage = input.toStage ?? stage;
  const elapsed = input.elapsedMs ?? 0;
  const crossed = crossedStage(fromStage, toStage);
  let look = lookForStage(stage);
  let breath = 1;

  if (input.moment === 'settle') {
    look = lookForStage(fromStage);
    breath = settleBreathScale(elapsed, reduced);
  } else if (input.moment === 'bloom') {
    look = bloomLook(lookForStage(fromStage), lookForStage(toStage), elapsed, reduced, crossed);
    breath = 1;
  } else if (input.moment === 'focusing') {
    look = lookForStage(fromStage);
    breath = focusDriftScale(elapsed, reduced);
  } else {
    look = lookForStage(stage);
    breath = 1;
  }

  return {
    moment: input.moment,
    stage: input.moment === 'bloom' || input.moment === 'focusing' ? toStage : fromStage,
    fromStage,
    toStage,
    minutes,
    look,
    breath,
    crossed,
  };
}

export function growthPointScale(look: OrbLook, breath: number, normalizedRadius: number): number {
  const loosen = 1 + (1 - look.tightness) * Math.min(1, Math.max(0, normalizedRadius));
  return look.scale * breath * loosen;
}
