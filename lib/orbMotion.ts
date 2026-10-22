import { scatterFromVisualInput, type MiniVisualInput } from './miniOrb';

export const GATHER_MS = 2000;
export const SCATTER_MAX_DELTA_PER_SEC = 0.55;
export const SCATTER_FRAME_DELTA_LIMIT = 0.02;
export const SCATTER_BREATH_AMPLITUDE = 0.01;
export const RADIUS_REGEN_PX = 4;

export function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/** Single scatter target for the main orb and the mini/PiP. */
export function scatterTarget(input: MiniVisualInput): number {
  return scatterFromVisualInput(input);
}

/**
 * Production main blended visual scatter with a restarting gather.
 * gatherT starts at 1 (fully scattered) and eases toward the target.
 * Restarting this every tick is what made the dots flash.
 */
export function visualScatterFromGather(
  target: number,
  gatherLeftMs: number,
  gatherMs: number = GATHER_MS
): number {
  const gatherT =
    gatherLeftMs <= 0 ? 0 : (Math.max(0, gatherLeftMs) / gatherMs) ** 2;
  return clamp01(gatherT + (1 - gatherT) * target);
}

/** Ease visual scatter toward the target. Breathing must not call this. */
export function stepVisualScatter(
  visual: number,
  target: number,
  dtMs: number,
  maxDeltaPerSec: number = SCATTER_MAX_DELTA_PER_SEC
): number {
  const maxStep = Math.max(0, maxDeltaPerSec) * Math.max(0, dtMs) / 1000;
  const delta = target - visual;
  if (Math.abs(delta) <= maxStep) return clamp01(target);
  return clamp01(visual + Math.sign(delta) * maxStep);
}

export function shouldRegeneratePoints(
  previousRadius: number,
  nextRadius: number,
  threshold: number = RADIUS_REGEN_PX
): boolean {
  if (previousRadius <= 0) return true;
  return Math.abs(nextRadius - previousRadius) > threshold;
}

export interface ScatterSampleAnalysis {
  min: number;
  max: number;
  range: number;
  maxAbsDelta: number;
  signFlips: number;
  deltas: number[];
  oscillates: boolean;
}

export function analyzeScatterSamples(
  samples: number[],
  options: {
    maxDelta?: number;
    breathAmplitude?: number;
  } = {}
): ScatterSampleAnalysis {
  const maxDelta = options.maxDelta ?? SCATTER_FRAME_DELTA_LIMIT;
  const breath = options.breathAmplitude ?? SCATTER_BREATH_AMPLITUDE;
  if (samples.length === 0) {
    return {
      min: 0,
      max: 0,
      range: 0,
      maxAbsDelta: 0,
      signFlips: 0,
      deltas: [],
      oscillates: false,
    };
  }

  let min = samples[0];
  let max = samples[0];
  let maxAbsDelta = 0;
  let signFlips = 0;
  let prevSign = 0;
  const deltas: number[] = [];

  for (let i = 1; i < samples.length; i++) {
    const value = samples[i];
    min = Math.min(min, value);
    max = Math.max(max, value);
    const delta = value - samples[i - 1];
    deltas.push(delta);
    maxAbsDelta = Math.max(maxAbsDelta, Math.abs(delta));
    const sign = delta > 1e-9 ? 1 : delta < -1e-9 ? -1 : 0;
    if (
      sign !== 0 &&
      prevSign !== 0 &&
      sign !== prevSign &&
      Math.abs(delta) > breath
    ) {
      signFlips += 1;
    }
    if (sign !== 0) prevSign = sign;
  }

  return {
    min,
    max,
    range: max - min,
    maxAbsDelta,
    signFlips,
    deltas,
    oscillates: signFlips > 0 || maxAbsDelta > maxDelta,
  };
}

export function simulateScatterFrames(options: {
  durationMs?: number;
  frameMs?: number;
  target: number | ((elapsedMs: number) => number);
  initialVisual?: number;
  remountGatherEveryMs?: number;
}): number[] {
  const durationMs = options.durationMs ?? 10_000;
  const frameMs = options.frameMs ?? 16;
  const samples: number[] = [];
  let visual = options.initialVisual ?? 0;
  let gatherUntil = -Infinity;

  for (let elapsed = 0; elapsed <= durationMs; elapsed += frameMs) {
    const target =
      typeof options.target === 'function'
        ? options.target(elapsed)
        : options.target;

    if (
      options.remountGatherEveryMs &&
      options.remountGatherEveryMs > 0 &&
      elapsed % options.remountGatherEveryMs < frameMs
    ) {
      gatherUntil = elapsed + GATHER_MS;
    }

    if (options.remountGatherEveryMs) {
      visual = visualScatterFromGather(target, gatherUntil - elapsed);
    } else {
      visual = stepVisualScatter(visual, target, frameMs);
    }
    samples.push(visual);
  }

  return samples;
}
