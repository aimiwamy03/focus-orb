import { afterEach, describe, expect, it } from 'vitest';
import {
  combineWhoopRhythms,
  cycleWhoopMode,
  detectWhoopStates,
  hideWhoopLineForToday,
  isLateDay,
  isWhoopLineHidden,
  justWorkedOut,
  recordWhoopNudge,
  recoveryBand,
  rhythmForState,
  shouldStopWhoopNudge,
  suggestWhoop,
  whoopLineKey,
  whoopQuietLine,
  whoopSettingsStatus,
  WHOOP_LEARNING_LABEL,
  WHOOP_NO_DATA_LABEL,
  WHOOP_DISCONNECTED_LABEL,
  WHOOP_USUAL,
  type WhoopFacts,
  type WhoopState,
} from './whoop';

const noon = Date.parse('2026-10-22T12:00:00');

function facts(partial: Partial<WhoopFacts> = {}): WhoopFacts {
  return {
    recovery: 82,
    recoveryState: 'scored',
    sleepPerformance: 90,
    sleepDebtMinutes: 0,
    yesterdayStrain: 8,
    lastWorkoutEndedAt: null,
    wakeAt: noon - 4 * 60 * 60 * 1000,
    now: noon,
    ...partial,
  };
}

afterEach(() => {
  localStorage.clear();
});

describe('recovery bands', () => {
  it('matches WHOOP green, yellow, and red', () => {
    expect(recoveryBand(100)).toBe('green');
    expect(recoveryBand(67)).toBe('green');
    expect(recoveryBand(66)).toBe('yellow');
    expect(recoveryBand(34)).toBe('yellow');
    expect(recoveryBand(33)).toBe('red');
    expect(recoveryBand(0)).toBe('red');
    expect(recoveryBand(null)).toBeNull();
  });
});

describe('rhythmForState', () => {
  it('uses 50/10 and 4 blocks on green', () => {
    expect(rhythmForState('green')).toEqual({
      firstBlockMinutes: 50,
      blockMinutes: 50,
      breakMinutes: 10,
      blocks: 4,
    });
  });

  it('uses 40/8 on yellow', () => {
    expect(rhythmForState('yellow')).toEqual({
      firstBlockMinutes: 40,
      blockMinutes: 40,
      breakMinutes: 8,
      blocks: 4,
    });
  });

  it('uses 25/5 and 3 blocks on red', () => {
    expect(rhythmForState('red')).toEqual({
      firstBlockMinutes: 25,
      blockMinutes: 25,
      breakMinutes: 5,
      blocks: 3,
    });
  });

  it('caps the first block at 30m on poor sleep', () => {
    expect(rhythmForState('sleep')).toEqual({
      firstBlockMinutes: 30,
      blockMinutes: 50,
      breakMinutes: 8,
      blocks: 3,
    });
  });

  it('uses 30/10 and 3 blocks on sleep debt', () => {
    expect(rhythmForState('debt')).toEqual({
      firstBlockMinutes: 30,
      blockMinutes: 30,
      breakMinutes: 10,
      blocks: 3,
    });
  });

  it('drops one block and adds 5m to the break after a hard yesterday', () => {
    expect(rhythmForState('strain')).toEqual({
      firstBlockMinutes: 50,
      blockMinutes: 50,
      breakMinutes: 15,
      blocks: 3,
    });
  });

  it('starts with 20m after a workout', () => {
    expect(rhythmForState('workout')).toEqual({
      firstBlockMinutes: 20,
      blockMinutes: 50,
      breakMinutes: 5,
      blocks: 4,
    });
  });

  it('uses 25/5 and 2 blocks late in the day', () => {
    expect(rhythmForState('late')).toEqual({
      firstBlockMinutes: 25,
      blockMinutes: 25,
      breakMinutes: 5,
      blocks: 2,
    });
  });

  it('leaves the usual rhythm alone while recovery is pending', () => {
    expect(rhythmForState('pending')).toEqual(WHOOP_USUAL);
  });
});

describe('detectWhoopStates', () => {
  it('detects each isolated state from facts', () => {
    expect(detectWhoopStates(facts({ recovery: 82 }))).toContain('green');
    expect(detectWhoopStates(facts({ recovery: 51 }))).toContain('yellow');
    expect(detectWhoopStates(facts({ recovery: 28 }))).toContain('red');
    expect(detectWhoopStates(facts({ sleepPerformance: 62 }))).toContain('sleep');
    expect(detectWhoopStates(facts({ sleepDebtMinutes: 45 }))).toContain('debt');
    expect(detectWhoopStates(facts({ yesterdayStrain: 14 }))).toContain('strain');
    expect(
      detectWhoopStates(facts({ lastWorkoutEndedAt: noon - 10 * 60_000 }))
    ).toContain('workout');
    expect(
      detectWhoopStates(facts({ wakeAt: noon - 10 * 60 * 60 * 1000 }))
    ).toContain('late');
    expect(detectWhoopStates(facts({ recoveryState: 'pending', recovery: null }))).toEqual([
      'pending',
    ]);
  });

  it('treats calibrating as pending and skips recovery bands', () => {
    expect(
      detectWhoopStates(facts({ recoveryState: 'calibrating', recovery: 40 }))
    ).toEqual(['pending']);
  });

  it('ignores a workout older than 45 minutes', () => {
    expect(
      justWorkedOut(noon - 46 * 60_000, noon)
    ).toBe(false);
    expect(
      detectWhoopStates(facts({ lastWorkoutEndedAt: noon - 46 * 60_000 }))
    ).not.toContain('workout');
  });

  it('uses hours since wake, then 6pm when wake is unknown', () => {
    expect(isLateDay(noon - 10 * 60 * 60 * 1000, noon)).toBe(true);
    expect(isLateDay(noon - 9 * 60 * 60 * 1000, noon)).toBe(false);
    expect(isLateDay(null, Date.parse('2026-10-22T18:00:00'))).toBe(true);
    expect(isLateDay(null, Date.parse('2026-10-22T17:59:00'))).toBe(false);
  });
});

describe('combineWhoopRhythms', () => {
  it('takes the shortest block, longest break, and fewest blocks', () => {
    expect(combineWhoopRhythms(['red', 'workout'])).toEqual({
      firstBlockMinutes: 20,
      blockMinutes: 25,
      breakMinutes: 5,
      blocks: 3,
    });
    expect(combineWhoopRhythms(['sleep', 'debt', 'strain'])).toEqual({
      firstBlockMinutes: 30,
      blockMinutes: 30,
      breakMinutes: 15,
      blocks: 3,
    });
    expect(combineWhoopRhythms(['green', 'late'])).toEqual({
      firstBlockMinutes: 25,
      blockMinutes: 25,
      breakMinutes: 10,
      blocks: 2,
    });
    expect(combineWhoopRhythms(['yellow', 'workout', 'strain'])).toEqual({
      firstBlockMinutes: 20,
      blockMinutes: 40,
      breakMinutes: 15,
      blocks: 3,
    });
  });

  it('ignores pending when combining', () => {
    expect(combineWhoopRhythms(['pending'])).toEqual(WHOOP_USUAL);
    expect(combineWhoopRhythms(['pending', 'yellow'])).toEqual(rhythmForState('yellow'));
  });
});

describe('quiet line', () => {
  it('picks one line by priority', () => {
    const order: WhoopState[] = [
      'workout',
      'red',
      'sleep',
      'debt',
      'strain',
      'late',
      'yellow',
      'green',
    ];
    expect(whoopLineKey(order)).toBe('workout');
    expect(whoopLineKey(['green', 'red', 'sleep'])).toBe('red');
    expect(whoopLineKey(['yellow', 'late'])).toBe('late');
    expect(whoopLineKey(['green'])).toBe('green');
    expect(whoopLineKey(['pending'])).toBe('pending');
  });

  it('shows numbers by default and words when asked', () => {
    expect(whoopQuietLine('red', facts({ recovery: 28 }), true)).toBe(
      'Recovery 28%. Shorter blocks today.'
    );
    expect(whoopQuietLine('red', facts({ recovery: 28 }), false)).toBe('Low recovery day.');
    expect(whoopQuietLine('green', facts({ recovery: 82 }), true)).toBe(
      'Recovery 82%. Good day for deep work.'
    );
    expect(whoopQuietLine('yellow', facts({ recovery: 51 }), true)).toBe(
      'Recovery 51%. Steady blocks today.'
    );
    expect(whoopQuietLine('sleep', facts({ sleepPerformance: 62 }), true)).toBe(
      'Sleep 62%. Start with something light.'
    );
    expect(whoopQuietLine('sleep', facts({ sleepPerformance: 62 }), false)).toBe(
      'Start with something light.'
    );
    expect(whoopQuietLine('workout', facts(), true)).toBe(
      'Fresh off a workout. Ease in with 20 minutes.'
    );
    expect(whoopQuietLine('pending', facts(), true)).toBe('Recovery not ready yet.');
  });

  it('builds a full suggestion from facts', () => {
    const suggestion = suggestWhoop(
      facts({
        recovery: 28,
        lastWorkoutEndedAt: noon - 5 * 60_000,
      }),
      true
    );
    expect(suggestion.lineKey).toBe('workout');
    expect(suggestion.line).toContain('workout');
    expect(suggestion.rhythm.firstBlockMinutes).toBe(20);
    expect(suggestion.rhythm.blocks).toBe(3);
  });
});

describe('settings copy and mode', () => {
  it('labels disconnected, empty, and calibrating days', () => {
    expect(whoopSettingsStatus('disconnected')).toBe(WHOOP_DISCONNECTED_LABEL);
    expect(whoopSettingsStatus('no-data')).toBe(WHOOP_NO_DATA_LABEL);
    expect(whoopSettingsStatus('calibrating')).toBe(WHOOP_LEARNING_LABEL);
    expect(whoopSettingsStatus('ok')).toBeNull();
  });

  it('cycles Off, Suggest only, Adapt defaults', () => {
    expect(cycleWhoopMode('off', 1)).toBe('suggest');
    expect(cycleWhoopMode('suggest', 1)).toBe('adapt');
    expect(cycleWhoopMode('adapt', 1)).toBe('off');
    expect(cycleWhoopMode('suggest', -1)).toBe('off');
  });
});

describe('hide line and nudge limit', () => {
  it('hides the line for the rest of the local day', () => {
    expect(isWhoopLineHidden(noon)).toBe(false);
    hideWhoopLineForToday(noon);
    expect(isWhoopLineHidden(noon)).toBe(true);
    expect(isWhoopLineHidden(Date.parse('2026-10-23T12:00:00'))).toBe(false);
  });

  it('stops nudging after three ignored lengths on the same kind of day', () => {
    recordWhoopNudge('red', 50, 25, noon);
    recordWhoopNudge('red', 90, 25, noon);
    expect(shouldStopWhoopNudge('red', noon)).toBe(false);
    recordWhoopNudge('red', 90, 25, noon);
    expect(shouldStopWhoopNudge('red', noon)).toBe(true);
    expect(shouldStopWhoopNudge('green', noon)).toBe(false);
  });
});
