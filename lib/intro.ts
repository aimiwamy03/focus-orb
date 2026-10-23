import { MANUAL_FOCUS_KEY } from './useManualFocus';

export const INTRO_SESSION_KEY = 'focusOrb:introPlayed';
export const PLAY_INTRO_KEY = 'focusOrb:playIntro';
export const INTRO_SOUND_KEY = 'focusOrb:introSound';
export const PLAY_INTRO_LABEL = 'Play intro';
export const REPLAY_INTRO_LABEL = 'Replay intro';
export const INTRO_SOUND_LABEL = 'Intro sound';
export const INTRO_SKIP_HINT = 'Skip (Esc)';
export const INTRO_HINT_COLOR = '#a1a1a6';
export const INTRO_HINT_SIZE_PX = 16;
export const INTRO_MIN_CAPTION_PX = 24;
export const INTRO_TITLE_TRACKING = '0.04em';
export const INTRO_NARROW_PX = 520;
export const INTRO_NARROW_ART_ZOOM = 1.45;
export const INTRO_ART_SRC = '/intro/intro-brain.webp';
export const INTRO_ART_FALLBACK = '/intro/intro-brain.jpg';
export const INTRO_FONT_SRC = '/intro/cormorant.woff2';

export const INTRO_TURN = 0.42;
export const INTRO_HOLD = 1.3;
export const INTRO_BEAT = INTRO_TURN + INTRO_HOLD;
export const INTRO_SKIP_MS = 300;
export const INTRO_REDUCED_TOTAL = 4;
export const INTRO_PUNCH = 0.12;
export const INTRO_HINT_AT = 1.0;
export const INTRO_HINT_FADE = 0.6;

export const INTRO_MIX = {
  bed: 0.35,
  turn: 0.8,
  tick: 0.35,
  resolve: 0.6,
  turnHit: 0.13,
} as const;

export const INTRO_AUDIO = {
  bed: '/intro/bed.mp3',
  turn: '/intro/turn.mp3',
  tick: '/intro/tick.mp3',
  resolve: '/intro/resolve.mp3',
} as const;

export const INTRO_LINES = [
  '',
  'The brain can\u2019t do two things at once.',
  'Every switch burns energy.',
  'So spend it on one thing.',
] as const;

export type IntroAudioName = keyof typeof INTRO_AUDIO;

export interface IntroTimeline {
  artIn: [number, number];
  dimStart: number;
  dimEnd: number;
  turns: [number, number, number, number];
  punch: number;
  hintAt: number;
  hintFade: number;
  artOut: [number, number];
  homeIn: [number, number];
  total: number;
  turn: number;
  hold: number;
}

export function introTimeline(): IntroTimeline {
  const turns: [number, number, number, number] = [
    0.9,
    0.9 + INTRO_BEAT,
    0.9 + 2 * INTRO_BEAT,
    0.9 + 3 * INTRO_BEAT,
  ];
  const homeIn: [number, number] = [turns[3] + 0.7, turns[3] + 1.7];
  return {
    artIn: [0, 1.0],
    dimStart: 0.3,
    dimEnd: 0.9,
    turns,
    punch: INTRO_PUNCH,
    hintAt: INTRO_HINT_AT,
    hintFade: INTRO_HINT_FADE,
    artOut: [turns[3] + 0.25, turns[3] + 1.0],
    homeIn,
    total: homeIn[1],
    turn: INTRO_TURN,
    hold: INTRO_HOLD,
  };
}

export const INTRO_TIMELINE = introTimeline();

export function introClockSpeed(reduced: boolean): number {
  return reduced ? INTRO_TIMELINE.total / INTRO_REDUCED_TOTAL : 1;
}

export function introNarrow(width: number): boolean {
  return width <= INTRO_NARROW_PX;
}

export function introArtZoom(width: number): number {
  return introNarrow(width) ? INTRO_NARROW_ART_ZOOM : 1;
}

export function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

export function easeInOut(x: number): number {
  return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
}

export function ramp(t: number, a: number, b: number): number {
  if (b === a) return t >= b ? 1 : 0;
  return clamp((t - a) / (b - a));
}

/** cubic-bezier(0.7, 0, 0.2, 1): slow wind-up, hard middle, firm landing. */
export function bezierEase(x1: number, y1: number, x2: number, y2: number) {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const X = (s: number) => ((ax * s + bx) * s + cx) * s;
  const Y = (s: number) => ((ay * s + by) * s + cy) * s;
  const dX = (s: number) => (3 * ax * s + 2 * bx) * s + cx;
  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let s = x;
    for (let i = 0; i < 8; i++) {
      const err = X(s) - x;
      const d = dX(s);
      if (Math.abs(err) < 1e-6) break;
      if (Math.abs(d) < 1e-6) break;
      s -= err / d;
    }
    s = clamp(s);
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 20 && Math.abs(X(s) - x) > 1e-5; i++) {
      if (X(s) < x) lo = s;
      else hi = s;
      s = (lo + hi) / 2;
    }
    return Y(s);
  };
}

export const introTurnEase = bezierEase(0.7, 0, 0.2, 1);

export interface IntroBeat {
  turned: number;
  inTurn: number;
  turnP: number;
}

export function introBeat(t: number, timeline: IntroTimeline = INTRO_TIMELINE): IntroBeat {
  let turned = 0;
  let inTurn = -1;
  let turnP = 0;
  timeline.turns.forEach((start, i) => {
    if (t >= start + timeline.turn) turned = i + 1;
    else if (t >= start) {
      inTurn = i;
      turnP = (t - start) / timeline.turn;
    }
  });
  return { turned, inTurn, turnP };
}

export interface IntroSoundEvent {
  name: IntroAudioName;
  at: number;
  volume: number;
}

export function introSoundEvents(timeline: IntroTimeline = INTRO_TIMELINE): IntroSoundEvent[] {
  const events: IntroSoundEvent[] = [{ name: 'bed', at: 0, volume: INTRO_MIX.bed }];
  timeline.turns.forEach((start, i) => {
    const land = start + timeline.turn;
    events.push({ name: 'turn', at: land - INTRO_MIX.turnHit, volume: INTRO_MIX.turn });
    if (i < 3) events.push({ name: 'tick', at: land, volume: INTRO_MIX.tick });
  });
  events.push({ name: 'resolve', at: timeline.homeIn[0], volume: INTRO_MIX.resolve });
  return events;
}

export interface IntroSoundCue {
  name: IntroAudioName;
  volume: number;
  when: number;
  offset: number;
}

export function introSoundCuesAt(
  elapsed: number,
  events: IntroSoundEvent[] = introSoundEvents()
): IntroSoundCue[] {
  const t = Math.max(0, elapsed);
  const cues: IntroSoundCue[] = [];
  for (const event of events) {
    if (t <= event.at) {
      cues.push({ name: event.name, volume: event.volume, when: event.at - t, offset: 0 });
      continue;
    }
    if (event.name !== 'bed') continue;
    cues.push({ name: event.name, volume: event.volume, when: 0, offset: t - event.at });
  }
  return cues;
}

export function introPointerUnlocksSound(waitingForGesture: boolean): boolean {
  return waitingForGesture;
}

export interface IntroFrame {
  artOpacity: number;
  artTransform: string;
  artFilter: string;
  vigOpacity: number;
  sceneVisible: boolean;
  cubeAngle: number;
  restIndex: number;
  restText: string;
  restOpacity: number;
  restScale: number;
  restGlow: number;
  hintOpacity: number;
  overlayOpacity: number;
  done: boolean;
}

export function introFrame(
  t: number,
  reduced: boolean,
  timeline: IntroTimeline = INTRO_TIMELINE
): IntroFrame {
  const out = easeInOut(ramp(t, ...timeline.artOut));
  const fin = easeInOut(ramp(t, ...timeline.homeIn));
  const artO = easeInOut(ramp(t, ...timeline.artIn)) * (1 - out);
  const { turned, inTurn, turnP } = introBeat(t, timeline);
  const k = clamp(t / timeline.total);
  let steps = 0;
  if (!reduced) {
    timeline.turns.slice(0, 3).forEach((start) => {
      steps += introTurnEase(ramp(t, start + timeline.turn * 0.35, start + timeline.turn * 1.35));
    });
  }
  const scale = reduced ? 1 : 1 + 0.05 * k + 0.01 * steps;
  const dx = reduced ? 0 : -0.9 + 1.8 * k;
  const dy = reduced ? 0 : 0.5 - 1.0 * k;
  const dim = easeInOut(ramp(t, timeline.dimStart, timeline.dimEnd));

  let sceneVisible = false;
  let cubeAngle = 0;
  let restIndex = turned;
  let restOpacity = 0;
  let restScale = 1;
  let restGlow = 0;

  if (reduced) {
    let idx = turned;
    let opacity = 1;
    if (inTurn >= 0) {
      idx = turnP < 0.5 ? inTurn : inTurn + 1;
      opacity = Math.abs(turnP - 0.5) * 2;
    }
    restIndex = idx;
    restOpacity = idx > 0 && idx < 4 ? opacity : 0;
  } else if (inTurn >= 0) {
    sceneVisible = true;
    cubeAngle = (inTurn + introTurnEase(turnP)) * 90;
    restIndex = inTurn + 1;
  } else {
    restIndex = turned;
    restOpacity = turned > 0 && turned < 4 ? 1 : 0;
    const since = turned > 0 ? t - (timeline.turns[turned - 1] + timeline.turn) : 99;
    if (since < timeline.punch) {
      const p = since / timeline.punch;
      restScale = 1 + 0.015 * (1 - p);
      restGlow = 1 - p;
    }
  }

  const restText = restIndex > 0 && restIndex < INTRO_LINES.length ? INTRO_LINES[restIndex] : '';

  return {
    artOpacity: artO,
    artTransform: `translate(${dx}%, ${dy}%) scale(${scale})`,
    artFilter: `brightness(${1 - 0.5 * dim}) saturate(${1 - 0.15 * dim})`,
    vigOpacity: dim * (1 - out),
    sceneVisible,
    cubeAngle,
    restIndex,
    restText,
    restOpacity,
    restScale,
    restGlow,
    hintOpacity: ramp(t, timeline.hintAt, timeline.hintAt + timeline.hintFade) * (1 - out),
    overlayOpacity: 1 - fin,
    done: fin >= 1,
  };
}

export function isIntroSkipKey(key: string): boolean {
  return key === 'Escape' || key === 'Enter' || key === ' ';
}

export function loadIntroPlayed(): boolean {
  if (typeof sessionStorage === 'undefined') return false;
  return sessionStorage.getItem(INTRO_SESSION_KEY) === '1';
}

export function markIntroPlayed(): void {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.setItem(INTRO_SESSION_KEY, '1');
}

export function loadPlayIntro(): boolean {
  if (typeof localStorage === 'undefined') return true;
  return localStorage.getItem(PLAY_INTRO_KEY) !== '0';
}

export function savePlayIntro(value: boolean): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(PLAY_INTRO_KEY, value ? '1' : '0');
}

export const DEFAULT_INTRO_SOUND = true;

export function introSoundPref(stored: string | null | undefined): boolean {
  return stored !== '0';
}

export function loadIntroSound(): boolean {
  if (typeof localStorage === 'undefined') return DEFAULT_INTRO_SOUND;
  return introSoundPref(localStorage.getItem(INTRO_SOUND_KEY));
}

export function saveIntroSound(value: boolean): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(INTRO_SOUND_KEY, value ? '1' : '0');
}

export function shouldPlayEndResolve(input: {
  introSound: boolean;
  reducedMotion: boolean;
}): boolean {
  return input.introSound && !input.reducedMotion;
}

export function playEndResolve(): void {
  if (typeof Audio === 'undefined') return;
  try {
    const audio = new Audio(INTRO_AUDIO.resolve);
    audio.volume = INTRO_MIX.resolve;
    void audio.play().catch(() => {});
  } catch {
    // browsers may block autoplay
  }
}

export function isStoredFocusRunning(now = Date.now()): boolean {
  if (typeof localStorage === 'undefined') return false;
  try {
    const raw = localStorage.getItem(MANUAL_FOCUS_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { startTime?: number; duration?: number };
    if (typeof parsed.startTime !== 'number' || typeof parsed.duration !== 'number') return false;
    const elapsed = (now - parsed.startTime) / (1000 * 60);
    return elapsed >= 0 && elapsed < parsed.duration;
  } catch {
    return false;
  }
}

export function shouldPlayIntro(input: {
  introParam: string | null;
  sessionPlayed: boolean;
  playIntro: boolean;
  focusing: boolean;
  miniOnly: boolean;
}): boolean {
  if (input.introParam === '0') return false;
  if (input.introParam === '1') return true;
  if (input.miniOnly || input.focusing) return false;
  if (!input.playIntro) return false;
  if (input.sessionPlayed) return false;
  return true;
}

export function parseIntroFreeze(raw: string | null): number | null {
  if (raw == null || raw === '') return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}
