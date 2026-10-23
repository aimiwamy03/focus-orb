import { describe, expect, it, beforeEach } from 'vitest';
import type { FocusLogEntry } from './focusLog';
import {
  ONE_THING_PROMPT,
  ORB_BLOOM_MS,
  ORB_BLOOM_PREVIEW_BEFORE,
  ORB_BLOOM_PREVIEW_SESSION,
  ORB_GROWTH,
  ORB_SETTLE_BREATHS_PER_MIN,
  ORB_SETTLE_CYCLE_MS,
  ORB_SETTLE_IN_MS,
  ORB_SETTLE_OUT_MS,
  SETTLE_SESSION_KEY,
  attachGrowthFields,
  bloomLook,
  bloomProgress,
  countedMinutesToday,
  crossedStage,
  dayFinalStage,
  focusDriftScale,
  formatFocusedToday,
  growthPointScale,
  isOrbPreviewKey,
  loadSettlePlayed,
  markSettlePlayed,
  mixLooks,
  orbVisualState,
  previewMinutes,
  resolveDisplayMinutes,
  sessionCounts,
  settleBreathScale,
  shouldPlaySettle,
  stageForMinutes,
} from './orbGrowth';

function entry(partial: Partial<FocusLogEntry> & Pick<FocusLogEntry, 'id' | 'minutes' | 'ended'>): FocusLogEntry {
  const start = partial.startMs ?? Date.now();
  return {
    task: 'write the spec',
    startMs: start,
    endMs: partial.endMs ?? start + partial.minutes * 60_000,
    planned: partial.planned ?? 25,
    ...partial,
  };
}

const morning = new Date(2026, 9, 22, 10, 0, 0, 0);

describe('growth stages', () => {
  it('uses one tunable config and never shrinks a later stage', () => {
    expect(ORB_GROWTH.stages.map((stage) => [stage.key, stage.minMinutes])).toEqual([
      ['cluster', 0],
      ['gathering', 45],
      ['forming', 90],
      ['full', 150],
      ['radiant', 240],
    ]);
    expect(stageForMinutes(0).key).toBe('cluster');
    expect(stageForMinutes(44).key).toBe('cluster');
    expect(stageForMinutes(45).key).toBe('gathering');
    expect(stageForMinutes(89).key).toBe('gathering');
    expect(stageForMinutes(90).key).toBe('forming');
    expect(stageForMinutes(149).key).toBe('forming');
    expect(stageForMinutes(150).key).toBe('full');
    expect(stageForMinutes(239).key).toBe('full');
    expect(stageForMinutes(240).key).toBe('radiant');
    expect(stageForMinutes(400).look.scale).toBe(stageForMinutes(240).look.scale);
    expect(stageForMinutes(400).look.halo).toBe(1);
    expect(ONE_THING_PROMPT).toBe("What's the one thing?");
    expect(ONE_THING_PROMPT).not.toMatch(/[—–]/);
  });
});

describe('session counting', () => {
  it('counts completed sessions and 15 plus minute runs, minus paused time', () => {
    expect(sessionCounts({ minutes: 12, ended: 'ended-early' })).toEqual({
      counted: false,
      minutes: 0,
    });
    expect(sessionCounts({ minutes: 14, ended: 'ended-session' }).counted).toBe(false);
    expect(sessionCounts({ minutes: 15, ended: 'ended-early' })).toEqual({
      counted: true,
      minutes: 15,
    });
    expect(sessionCounts({ minutes: 8, ended: 'completed' })).toEqual({
      counted: true,
      minutes: 8,
    });
    expect(sessionCounts({ minutes: 25, pausedMinutes: 12, ended: 'ended-early' })).toEqual({
      counted: false,
      minutes: 0,
    });
    expect(sessionCounts({ minutes: 25, pausedMinutes: 5, ended: 'ended-early' })).toEqual({
      counted: true,
      minutes: 20,
    });
  });

  it('sums only today and keeps yesterday stage from counted minutes', () => {
    const today = morning.getTime();
    const yesterday = today - 86_400_000;
    const entries = [
      entry({ id: 'short', minutes: 8, ended: 'ended-early', startMs: today }),
      entry({ id: 'done', minutes: 50, ended: 'completed', startMs: today + 1 }),
      entry({ id: 'pause', minutes: 25, pausedMinutes: 6, ended: 'ended-early', startMs: today + 2 }),
      entry({
        id: 'yday',
        minutes: 90,
        ended: 'completed',
        startMs: yesterday,
        stageAfter: 2,
      }),
    ];
    expect(countedMinutesToday(entries, morning)).toBe(69);
    expect(dayFinalStage(entries, new Date(yesterday))?.key).toBe('forming');
    expect(dayFinalStage(entries, morning)?.key).toBe('gathering');
  });

  it('attaches stage before and after without inventing minutes', () => {
    const existing = [entry({ id: 'am', minutes: 40, ended: 'completed', startMs: morning.getTime() })];
    const draft = attachGrowthFields(
      {
        task: 'review pr',
        startMs: morning.getTime() + 3_600_000,
        endMs: morning.getTime() + 3_600_000 + 25 * 60_000,
        minutes: 25,
        planned: 25,
        ended: 'completed',
        pausedMinutes: 0,
      },
      { entries: existing, now: morning, settleSkipped: true }
    );
    expect(draft.minutesCounted).toBe(25);
    expect(draft.stageBefore).toBe(0);
    expect(draft.stageAfter).toBe(1);
    expect(draft.settleSkipped).toBe(true);
    expect(crossedStage(draft.stageBefore ?? 0, draft.stageAfter ?? 0)).toBe(true);
  });
});

describe('settle and bloom motion', () => {
  it('breathes six times a minute, 4s in and 6s out', () => {
    expect(ORB_SETTLE_CYCLE_MS).toBe(10_000);
    expect(ORB_SETTLE_BREATHS_PER_MIN).toBe(6);
    expect(ORB_SETTLE_IN_MS).toBe(4_000);
    expect(ORB_SETTLE_OUT_MS).toBe(6_000);
    expect(settleBreathScale(0)).toBeCloseTo(1);
    expect(settleBreathScale(4_000)).toBeGreaterThan(1.07);
    expect(settleBreathScale(10_000)).toBeCloseTo(1);
    expect(settleBreathScale(2_000, true)).toBe(1);
  });

  it('blooms in 2 to 3s and reduced motion only crossfades', () => {
    expect(ORB_BLOOM_MS).toBeGreaterThanOrEqual(2_000);
    expect(ORB_BLOOM_MS).toBeLessThanOrEqual(3_000);
    expect(bloomProgress(0)).toBe(0);
    expect(bloomProgress(ORB_BLOOM_MS)).toBe(1);
    expect(bloomProgress(10, true)).toBe(1);
    const from = stageForMinutes(0).look;
    const to = stageForMinutes(45).look;
    expect(bloomLook(from, to, 0).scale).toBeCloseTo(from.scale);
    expect(bloomLook(from, to, ORB_BLOOM_MS).scale).toBeCloseTo(to.scale);
    expect(bloomLook(from, to, 10, true).scale).toBeCloseTo(to.scale);
    expect(bloomLook(from, from, 1_200, false, false).glow).toBeGreaterThan(from.glow);
  });

  it('holds size still on open and barely drifts while focusing', () => {
    const still = orbVisualState({ minutes: 50, moment: 'still' });
    expect(still.breath).toBe(1);
    expect(still.look.scale).toBe(stageForMinutes(50).look.scale);
    const focusing = orbVisualState({
      minutes: 50,
      moment: 'focusing',
      elapsedMs: 9_000,
      fromStage: stageForMinutes(50),
    });
    expect(Math.abs(focusing.breath - 1)).toBeLessThan(0.004);
    expect(focusDriftScale(1_000, true)).toBe(1);
    expect(growthPointScale(still.look, 1, 1)).toBeGreaterThan(still.look.scale);
  });

  it('mixes looks without shrinking the cap', () => {
    const a = stageForMinutes(150).look;
    const b = stageForMinutes(240).look;
    expect(mixLooks(a, b, 1).scale).toBe(1);
    expect(mixLooks(a, b, 1).halo).toBe(1);
  });
});

describe('preview and settle gates', () => {
  it('reads orb preview keys and forced minutes', () => {
    expect(isOrbPreviewKey('cluster')).toBe(true);
    expect(isOrbPreviewKey('bloom')).toBe(true);
    expect(isOrbPreviewKey('empty')).toBe(false);
    expect(isOrbPreviewKey('orb-cluster'.slice(4))).toBe(true);
    expect(previewMinutes('radiant')).toBe(240);
    expect(previewMinutes('bloom')).toBe(ORB_BLOOM_PREVIEW_BEFORE + ORB_BLOOM_PREVIEW_SESSION);
    expect(resolveDisplayMinutes({ logMinutes: 12, preview: 'full', orbMinutesParam: null })).toBe(
      150
    );
    expect(resolveDisplayMinutes({ logMinutes: 12, preview: null, orbMinutesParam: '88' })).toBe(88);
    expect(formatFocusedToday(105)).toBe('1h 45m focused today.');
    expect(formatFocusedToday(105)).not.toMatch(/[—–]/);
  });

  it('plays settle once per visit unless forced or skipped', () => {
    expect(
      shouldPlaySettle({
        settleParam: null,
        preview: null,
        sessionPlayed: false,
        introOpen: false,
        focusing: false,
        miniOnly: false,
        firstOpen: false,
      })
    ).toBe(true);
    expect(
      shouldPlaySettle({
        settleParam: '0',
        preview: null,
        sessionPlayed: false,
        introOpen: false,
        focusing: false,
        miniOnly: false,
        firstOpen: false,
      })
    ).toBe(false);
    expect(
      shouldPlaySettle({
        settleParam: null,
        preview: 'cluster',
        sessionPlayed: false,
        introOpen: false,
        focusing: false,
        miniOnly: false,
        firstOpen: false,
      })
    ).toBe(false);
    expect(
      shouldPlaySettle({
        settleParam: null,
        preview: 'settle',
        sessionPlayed: true,
        introOpen: false,
        focusing: false,
        miniOnly: false,
        firstOpen: false,
      })
    ).toBe(true);
  });
});

describe('settle session flag', () => {
  beforeEach(() => {
    sessionStorage.removeItem(SETTLE_SESSION_KEY);
  });

  it('remembers a skipped or finished settle for this visit', () => {
    expect(loadSettlePlayed()).toBe(false);
    markSettlePlayed();
    expect(loadSettlePlayed()).toBe(true);
  });
});
