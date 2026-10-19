import { describe, it, expect } from 'vitest';
import { buildDayModel } from './day';
import { getMockEvents, parseNowParam } from './fixtures';
import {
  applyPipDocumentStyle,
  breathGlow,
  breathPhase,
  breathScale,
  BREATH_PERIOD_MS,
  canUseDocumentPip,
  CHROME_HINT,
  formatMiniStatus,
  LEAVE_TAB_HINT,
  loadPopOutOnLeave,
  MINI_STATUS_BAND,
  miniOrbKind,
  miniOrbLayout,
  miniVisualState,
  POP_OUT_ON_LEAVE_KEY,
  savePopOutOnLeave,
} from './miniOrb';

function pinned(hhmm: string): Date {
  return parseNowParam(hhmm, new Date(2026, 9, 9));
}

function modelFor(scenario: Parameters<typeof getMockEvents>[0], hhmm: string) {
  const now = pinned(hhmm);
  return { now, model: buildDayModel(getMockEvents(scenario, now), now) };
}

describe('breathPhase', () => {
  it('starts at rest, peaks at half the cycle, and returns at 5s', () => {
    expect(breathPhase(0)).toBeCloseTo(0, 5);
    expect(breathPhase(BREATH_PERIOD_MS / 2)).toBeCloseTo(1, 5);
    expect(breathPhase(BREATH_PERIOD_MS)).toBeCloseTo(0, 5);
    expect(breathPhase(BREATH_PERIOD_MS / 4)).toBeCloseTo(0.5, 5);
  });

  it('is a raised cosine, not a linear triangle', () => {
    const q = breathPhase(BREATH_PERIOD_MS / 8);
    expect(q).toBeGreaterThan(0);
    expect(q).toBeLessThan(0.5);
    expect(q).toBeCloseTo(0.5 - 0.5 * Math.cos(Math.PI / 4), 5);
  });

  it('wraps past one period and stays in 0..1', () => {
    expect(breathPhase(BREATH_PERIOD_MS * 2)).toBeCloseTo(0, 5);
    expect(breathPhase(-BREATH_PERIOD_MS / 2)).toBeCloseTo(1, 5);
    expect(breathPhase(1234)).toBeGreaterThanOrEqual(0);
    expect(breathPhase(1234)).toBeLessThanOrEqual(1);
  });
});

describe('breathScale and glow', () => {
  it('holds scale at 1 under reduced motion and still glows while focusing', () => {
    expect(breathScale(1, true)).toBe(1);
    expect(breathScale(1, false)).toBeGreaterThan(1);
    expect(breathGlow(1, true)).toBeGreaterThan(breathGlow(0, true));
    expect(breathGlow(1, false)).toBe(0);
  });
});

describe('mini visual state stays in sync with the day model', () => {
  it('is free and tight in an open afternoon', () => {
    const { now, model } = modelFor('open-afternoon', '11:00');
    const visual = miniVisualState({
      isManualFocus: false,
      focusMinutes: null,
      totalMinutes: null,
      model,
      now,
      scatterWindow: 15,
    });
    expect(visual.kind).toBe('free');
    expect(visual.scatter).toBe(0);
    expect(visual.focusing).toBe(false);
    expect(visual.dim).toBe(false);
    expect(formatMiniStatus(model, now)).toBe('Free 4h');
  });

  it('is meeting-soon when scatter has started', () => {
    const { now, model } = modelFor('pre-meeting', '13:20');
    const visual = miniVisualState({
      isManualFocus: false,
      focusMinutes: null,
      totalMinutes: null,
      model,
      now,
      scatterWindow: 60,
    });
    expect(visual.kind).toBe('meeting-soon');
    expect(visual.scatter).toBeGreaterThan(0.2);
    expect(formatMiniStatus(model, now)).toBe('Free 10m');
  });

  it('uses Meeting in Xm during the 5 minute heads-up', () => {
    const { now, model } = modelFor('pre-meeting', '13:25');
    expect(formatMiniStatus(model, now)).toBe('Meeting in 5m');
  });

  it('dims in a meeting', () => {
    const { now, model } = modelFor('in-meeting', '13:45');
    const visual = miniVisualState({
      isManualFocus: false,
      focusMinutes: null,
      totalMinutes: null,
      model,
      now,
      scatterWindow: 15,
    });
    expect(visual.kind).toBe('in-meeting');
    expect(visual.scatter).toBe(1);
    expect(visual.dim).toBe(true);
    expect(formatMiniStatus(model, now)).toBe('In Design sync');
  });

  it('is focus while a manual block is running, independent of the calendar scatter', () => {
    const { now, model } = modelFor('open-afternoon', '11:00');
    const visual = miniVisualState({
      isManualFocus: true,
      focusMinutes: 32,
      totalMinutes: 50,
      model,
      now,
      scatterWindow: 15,
    });
    expect(visual.kind).toBe('focus');
    expect(visual.focusing).toBe(true);
    expect(visual.scatter).toBe(0);
    expect(
      formatMiniStatus(model, now, { isManualFocus: true, focusMinutes: 32 })
    ).toBe('Focus 32m');
  });

  it('maps kind from scatter the same way for main and mini', () => {
    expect(miniOrbKind({ isManualFocus: false, state: 'free', scatter: 0 })).toBe(
      'free'
    );
    expect(
      miniOrbKind({ isManualFocus: false, state: 'free', scatter: 0.4 })
    ).toBe('meeting-soon');
    expect(
      miniOrbKind({ isManualFocus: false, state: 'in-meeting', scatter: 1 })
    ).toBe('in-meeting');
    expect(
      miniOrbKind({ isManualFocus: true, state: 'free', scatter: 0 })
    ).toBe('focus');
  });
});

describe('canUseDocumentPip', () => {
  it('is true only when Document Picture-in-Picture exists', () => {
    expect(canUseDocumentPip({})).toBe(false);
    expect(canUseDocumentPip({ documentPictureInPicture: {} })).toBe(true);
    expect(canUseDocumentPip(undefined)).toBe(false);
  });
});

describe('formatMiniStatus extra lines', () => {
  it('uses Click to stop when the second click is armed', () => {
    const { now, model } = modelFor('open-afternoon', '11:00');
    expect(
      formatMiniStatus(model, now, {
        isManualFocus: true,
        focusMinutes: 32,
        stopArmed: true,
      })
    ).toBe('Click to stop');
  });

  it('is Clear when the day is empty', () => {
    const { now, model } = modelFor('empty', '11:00');
    expect(formatMiniStatus(model, now)).toBe('Clear');
  });
});

describe('pop out on leave setting', () => {
  it('is off by default and round-trips through storage', () => {
    localStorage.removeItem(POP_OUT_ON_LEAVE_KEY);
    expect(loadPopOutOnLeave()).toBe(false);
    savePopOutOnLeave(true);
    expect(loadPopOutOnLeave()).toBe(true);
    savePopOutOnLeave(false);
    expect(loadPopOutOnLeave()).toBe(false);
  });
});

describe('hint copy', () => {
  it('has no em dashes', () => {
    expect(CHROME_HINT).not.toMatch(/[—–]/);
    expect(LEAVE_TAB_HINT).not.toMatch(/[—–]/);
  });
});

describe('miniOrbLayout centers in any PiP size', () => {
  it.each([
    [180, 180],
    [240, 180],
    [320, 240],
  ])('centers the orb in %i x %i above the status band', (width, height) => {
    const layout = miniOrbLayout(width, height);
    expect(layout.centerX).toBeCloseTo(width / 2);
    expect(layout.centerY).toBeCloseTo((height - MINI_STATUS_BAND) / 2);
    expect(layout.centerX / width).toBeCloseTo(0.5);
    expect(layout.centerY).toBeLessThan(height / 2);
  });
});

describe('applyPipDocumentStyle', () => {
  it('clears html/body margin and fills the window', () => {
    applyPipDocumentStyle(document);
    expect(document.documentElement.style.margin.replace('px', '')).toBe('0');
    expect(document.documentElement.style.width).toBe('100%');
    expect(document.documentElement.style.height).toBe('100%');
    expect(document.body.style.margin.replace('px', '')).toBe('0');
    expect(document.body.style.width).toBe('100%');
    expect(document.body.style.height).toBe('100%');
  });
});
