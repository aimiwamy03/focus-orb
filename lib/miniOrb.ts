import { DayModel, DayState, isHeadsUp, minutesBetween } from './day';
import { calculateManualScatter, calculateScatter } from './scatter';
import { formatCompactDuration } from './tab';

export const MINI_SIZE = 180;
export const MINI_STATUS_PAD_Y = 10;
export const MINI_STATUS_PAD_X = 12;
export const MINI_STATUS_LINE = 14;
export const MINI_STATUS_BAND = MINI_STATUS_PAD_Y * 2 + MINI_STATUS_LINE;
export const BREATH_PERIOD_MS = 5000;
export const POP_OUT_ON_LEAVE_KEY = 'focusOrb:popOutOnLeave';
export const MINI_BG = '#000000';

export interface MiniOrbLayout {
  centerX: number;
  centerY: number;
  radius: number;
  availableH: number;
}

export function miniOrbLayout(
  viewW: number,
  viewH: number,
  statusBand: number = MINI_STATUS_BAND
): MiniOrbLayout {
  const availableH = Math.max(1, viewH - Math.max(0, statusBand));
  return {
    centerX: viewW / 2,
    centerY: availableH / 2,
    radius: Math.min(viewW, availableH) * 0.28,
    availableH,
  };
}

export function applyPipDocumentStyle(doc: Document) {
  const html = doc.documentElement;
  const body = doc.body;
  html.style.margin = '0';
  html.style.width = '100%';
  html.style.height = '100%';
  body.style.margin = '0';
  body.style.width = '100%';
  body.style.height = '100%';
  body.style.background = MINI_BG;
  body.style.overflow = 'hidden';
}

export type MiniOrbKind = 'free' | 'focus' | 'meeting-soon' | 'in-meeting';

export interface MiniVisualInput {
  isManualFocus: boolean;
  focusMinutes: number | null;
  totalMinutes: number | null;
  model: DayModel;
  now: Date;
  scatterWindow: number;
}

export interface MiniVisualState {
  scatter: number;
  density: number;
  kind: MiniOrbKind;
  dim: boolean;
  focusing: boolean;
}

export function canUseDocumentPip(
  globalObj: { documentPictureInPicture?: unknown } | undefined = typeof window === 'undefined'
    ? undefined
    : window
): boolean {
  return Boolean(
    globalObj &&
      typeof globalObj.documentPictureInPicture === 'object' &&
      globalObj.documentPictureInPicture !== null
  );
}

export function prefersReducedMotion(
  match: { matches: boolean } | null = typeof window === 'undefined'
    ? null
    : window.matchMedia('(prefers-reduced-motion: reduce)')
): boolean {
  return Boolean(match?.matches);
}

export function breathPhase(nowMs: number, periodMs: number = BREATH_PERIOD_MS): number {
  if (periodMs <= 0) return 0;
  const t = ((nowMs % periodMs) + periodMs) % periodMs;
  return 0.5 - 0.5 * Math.cos((2 * Math.PI * t) / periodMs);
}

export function breathScale(phase: number, reducedMotion: boolean): number {
  if (reducedMotion) return 1;
  return 1 + 0.08 * phase;
}

export function breathGlow(phase: number, focusing: boolean): number {
  if (!focusing) return 0;
  return 0.2 + 0.8 * phase;
}

export function scatterFromVisualInput(input: MiniVisualInput): number {
  if (
    input.isManualFocus &&
    input.focusMinutes != null &&
    input.totalMinutes != null
  ) {
    return calculateManualScatter(input.focusMinutes, input.totalMinutes);
  }
  if (input.model.state === 'in-meeting' || input.model.state === 'in-run') {
    return 1;
  }
  if (input.model.nextEvent) {
    return calculateScatter(
      minutesBetween(input.now, input.model.nextEvent.start),
      input.scatterWindow
    );
  }
  return 0;
}

export function miniOrbKind(input: {
  isManualFocus: boolean;
  state: DayState;
  scatter: number;
}): MiniOrbKind {
  if (input.isManualFocus) return 'focus';
  if (input.state === 'in-meeting' || input.state === 'in-run') return 'in-meeting';
  if (input.scatter >= 0.2) return 'meeting-soon';
  return 'free';
}

export function miniVisualState(input: MiniVisualInput): MiniVisualState {
  const scatter = scatterFromVisualInput(input);
  const focusing = input.isManualFocus;
  const dim =
    input.model.state === 'in-meeting' || input.model.state === 'in-run';
  return {
    scatter,
    density: dim ? 0.45 : 1,
    kind: miniOrbKind({
      isManualFocus: focusing,
      state: input.model.state,
      scatter,
    }),
    dim,
    focusing,
  };
}

export function formatMiniStatus(
  model: DayModel,
  now: Date,
  options: {
    isManualFocus?: boolean;
    focusMinutes?: number | null;
    stopArmed?: boolean;
  } = {}
): string {
  if (options.stopArmed) return 'Click to stop';
  if (options.isManualFocus && options.focusMinutes != null) {
    return `Focus ${formatCompactDuration(options.focusMinutes)}`;
  }
  if (isHeadsUp(model, now) && model.nextEvent) {
    const minutes = Math.max(1, Math.ceil(minutesBetween(now, model.nextEvent.start)));
    return `Meeting in ${minutes}m`;
  }
  if (model.state === 'in-run' && model.currentEvent) {
    return `In ${model.currentEvent.summary}`;
  }
  if (model.state === 'in-meeting' && model.currentEvent) {
    return `In ${model.currentEvent.summary}`;
  }
  if (model.nextEvent && model.gapMinutes != null) {
    return `Free ${formatCompactDuration(model.gapMinutes)}`;
  }
  return 'Clear';
}

export function loadPopOutOnLeave(): boolean {
  if (typeof localStorage === 'undefined') return false;
  return localStorage.getItem(POP_OUT_ON_LEAVE_KEY) === '1';
}

export function savePopOutOnLeave(value: boolean): void {
  if (typeof localStorage === 'undefined') return;
  if (value) localStorage.setItem(POP_OUT_ON_LEAVE_KEY, '1');
  else localStorage.removeItem(POP_OUT_ON_LEAVE_KEY);
}

export const FLOATING_RESTORE_LABEL = 'Floating, click to restore';
export const POP_OUT_LABEL = 'Pop out';
export const MINI_ONLY_LABEL = 'Mini only';
export const POP_OUT_ON_LEAVE_LABEL = 'Pop out when I leave this tab';
export const CHROME_HINT = 'Pop out works in Chrome';
export const LEAVE_TAB_HINT = 'Click Pop out to keep the orb with you';
