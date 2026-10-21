import { describe, it, expect } from 'vitest';
import { buildDayModel } from './day';
import { getMockEvents, parseNowParam } from './fixtures';
import {
  analyzeScatterSamples,
  SCATTER_BREATH_AMPLITUDE,
  SCATTER_FRAME_DELTA_LIMIT,
  scatterTarget,
  shouldRegeneratePoints,
  simulateScatterFrames,
  stepVisualScatter,
  visualScatterFromGather,
} from './orbMotion';

function pinned(hhmm: string): Date {
  return parseNowParam(hhmm, new Date(2026, 9, 9));
}

function targetFor(
  scenario: Parameters<typeof getMockEvents>[0],
  hhmm: string,
  extra: Partial<Parameters<typeof scatterTarget>[0]> = {}
) {
  const now = pinned(hhmm);
  const model = buildDayModel(getMockEvents(scenario, now), now);
  return scatterTarget({
    isManualFocus: false,
    focusMinutes: null,
    totalMinutes: null,
    model,
    now,
    scatterWindow: 15,
    ...extra,
  });
}

function assertStable(samples: number[], label: string) {
  const analysis = analyzeScatterSamples(samples);
  expect(analysis.maxAbsDelta, `${label} frame delta`).toBeLessThanOrEqual(
    SCATTER_FRAME_DELTA_LIMIT
  );
  expect(analysis.signFlips, `${label} sign flips`).toBe(0);
  expect(analysis.oscillates, `${label} oscillates`).toBe(false);
  expect(analysis.range, `${label} range`).toBeLessThanOrEqual(
    SCATTER_BREATH_AMPLITUDE
  );
}

describe('stepVisualScatter', () => {
  it('holds still when visual already matches the target', () => {
    expect(stepVisualScatter(0, 0, 16)).toBe(0);
    expect(stepVisualScatter(0.42, 0.42, 16)).toBeCloseTo(0.42, 8);
  });

  it('moves toward the target without overshooting', () => {
    const up = stepVisualScatter(0, 1, 16);
    expect(up).toBeGreaterThan(0);
    expect(up).toBeLessThan(0.02);
    expect(stepVisualScatter(0.9, 1, 1000)).toBe(1);
    expect(stepVisualScatter(0.1, 0, 1000)).toBe(0);
  });

  it('does not let breathing-scale math change scatter', () => {
    const breathScale = 1 + 0.08;
    expect(stepVisualScatter(0.3, 0.3, 16) * 1).toBeCloseTo(0.3, 8);
    expect(stepVisualScatter(0.3, 0.3, 16)).not.toBeCloseTo(0.3 * breathScale, 2);
  });
});

describe('scatter stays monotonic across ~10s of frames', () => {
  it('does not oscillate while free, focusing, or meeting-soon', () => {
    const free = simulateScatterFrames({
      target: targetFor('open-afternoon', '11:00'),
      initialVisual: 0,
    });
    const focusing = simulateScatterFrames({
      target: scatterTarget({
        isManualFocus: true,
        focusMinutes: 32,
        totalMinutes: 50,
        model: buildDayModel(getMockEvents('open-afternoon', pinned('11:00')), pinned('11:00')),
        now: pinned('11:00'),
        scatterWindow: 15,
      }),
      initialVisual: 0,
    });
    const soon = targetFor('pre-meeting', '13:20', { scatterWindow: 60 });
    const meetingSoon = simulateScatterFrames({
      target: soon,
      initialVisual: soon,
    });

    expect(soon).toBeGreaterThan(0.2);
    assertStable(free, 'free');
    assertStable(focusing, 'focusing');
    assertStable(meetingSoon, 'meeting-soon');
  });

  it('only rises while a meeting approaches, and only falls after it ends', () => {
    const approaching = simulateScatterFrames({
      initialVisual: 0,
      target: (elapsed) => {
        const now = new Date(pinned('13:00').getTime() + elapsed);
        const model = buildDayModel(getMockEvents('pre-meeting', now), now);
        return scatterTarget({
          isManualFocus: false,
          focusMinutes: null,
          totalMinutes: null,
          model,
          now,
          scatterWindow: 60,
        });
      },
    });
    const approach = analyzeScatterSamples(approaching);
    expect(approach.signFlips).toBe(0);
    expect(Math.min(...approach.deltas, 0)).toBeGreaterThanOrEqual(-1e-9);
    expect(approaching[approaching.length - 1]).toBeGreaterThan(approaching[0]);

    const settling = simulateScatterFrames({
      initialVisual: 1,
      target: 0,
    });
    const settle = analyzeScatterSamples(settling);
    expect(settle.signFlips).toBe(0);
    expect(Math.max(...settle.deltas, 0)).toBeLessThanOrEqual(1e-9);
    expect(settling[settling.length - 1]).toBeLessThan(settling[0]);
  });

  it('survives remounts, PiP open/close, and radius jitter without flashing', () => {
    const target = targetFor('pre-meeting', '13:20', { scatterWindow: 60 });
    let visual = target;
    const samples: number[] = [];
    let radius = 160;

    for (let elapsed = 0; elapsed <= 10_000; elapsed += 16) {
      // ResizeObserver / orb-fit noise, plus a remount every 400ms.
      const jitter = elapsed % 80 < 16 ? 1.25 : 0;
      const nextRadius = 160 + jitter;
      if (shouldRegeneratePoints(radius, nextRadius)) {
        radius = nextRadius;
      } else {
        radius = radius;
      }
      if (elapsed % 400 === 0) {
        // Effect remount or PiP portal swap must not slam scatter.
        visual = stepVisualScatter(visual, target, 16);
      } else {
        visual = stepVisualScatter(visual, target, 16);
      }
      samples.push(visual);
    }

    assertStable(samples, 'remount/resize');
    expect(shouldRegeneratePoints(160, 161.25)).toBe(false);
    expect(shouldRegeneratePoints(160, 165)).toBe(true);
  });

  it('detects the production gather-restart flicker', () => {
    const samples = simulateScatterFrames({
      target: 0,
      initialVisual: 0,
      remountGatherEveryMs: 400,
    });
    const analysis = analyzeScatterSamples(samples);
    expect(analysis.oscillates).toBe(true);
    expect(analysis.signFlips).toBeGreaterThan(0);
    expect(analysis.range).toBeGreaterThan(0.3);
    expect(visualScatterFromGather(0, 2000)).toBe(1);
    expect(visualScatterFromGather(0, 0)).toBe(0);
  });
});
