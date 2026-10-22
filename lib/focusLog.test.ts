import { describe, expect, it, beforeEach } from 'vitest';
import {
  CLEAR_LOG_LABEL,
  CLEAR_LOG_PROMPT,
  DELETE_LOG_PROMPT,
  FOCUS_LOG_KEY,
  FOCUS_LOG_MOCK_KEY,
  LOG_EMPTY,
  LOG_ENDED_EARLY,
  LOG_LABEL,
  clearFocusLog,
  dayLabel,
  deleteFocusLogEntry,
  focusLogKey,
  formatDayFocused,
  formatFocusedMinutes,
  formatLogDayHeading,
  formatLogRange,
  getFocusLogFixture,
  groupFocusLog,
  loadFocusLog,
  recordFocusLog,
  saveFocusLog,
  taskTotals,
} from './focusLog';

const now = new Date(2026, 9, 22, 18, 0, 0, 0);

describe('focusLogKey', () => {
  it('uses a mock key and per-email keys', () => {
    expect(focusLogKey({ mock: true, email: 'amy@example.com' })).toBe(FOCUS_LOG_MOCK_KEY);
    expect(focusLogKey({ email: 'Amy@Example.com' })).toBe(`${FOCUS_LOG_KEY}:amy@example.com`);
    expect(focusLogKey({})).toBe(FOCUS_LOG_KEY);
  });
});

describe('focus log storage', () => {
  const key = `${FOCUS_LOG_KEY}:test`;

  beforeEach(() => {
    localStorage.removeItem(key);
    localStorage.removeItem(FOCUS_LOG_MOCK_KEY);
  });

  it('records, deletes, and clears entries', () => {
    const recorded = recordFocusLog(key, {
      task: 'write the spec',
      startMs: now.getTime() - 25 * 60_000,
      endMs: now.getTime(),
      minutes: 25,
      planned: 25,
      ended: 'completed',
    });
    expect(recorded).toHaveLength(1);
    expect(loadFocusLog(key)[0].task).toBe('write the spec');

    const leftover = deleteFocusLogEntry(key, recorded[0].id);
    expect(leftover).toEqual([]);

    recordFocusLog(key, {
      task: 'review pr',
      startMs: now.getTime(),
      endMs: now.getTime() + 18 * 60_000,
      minutes: 18,
      planned: 50,
      ended: 'ended-early',
    });
    expect(clearFocusLog(key)).toEqual([]);
    expect(loadFocusLog(key)).toEqual([]);
  });

  it('ignores broken stored JSON', () => {
    localStorage.setItem(key, '{not json');
    expect(loadFocusLog(key)).toEqual([]);
    saveFocusLog(key, []);
    expect(loadFocusLog(key)).toEqual([]);
  });
});

describe('aggregation and copy', () => {
  it('groups Today, Yesterday, then dates, and sums Today by task', () => {
    const days = groupFocusLog(getFocusLogFixture(now), now);
    expect(days.map((day) => day.label)).toEqual(['Today', 'Yesterday', 'Mon, Oct 19']);
    expect(days[0].heading).toBe('Today, 1h 35m focused');
    expect(days[0].byTask.map((item) => `${item.task}:${item.minutes}`)).toEqual([
      'write the spec:50',
      'finish voice ai post:25',
      'review pr:20',
    ]);
    expect(days[1].byTask).toEqual([]);
    expect(days[1].minutes).toBe(140);
    expect(days[2].heading).toBe('Mon, Oct 19, 25m focused');
  });

  it('sums the same task on the same day and keeps Today visible when only older days exist', () => {
    const older = getFocusLogFixture(now).filter((entry) => !entry.id.startsWith('today-'));
    const days = groupFocusLog(older, now);
    expect(days[0].label).toBe('Today');
    expect(days[0].heading).toBe('Today');
    expect(days[0].entries).toEqual([]);
    expect(days[0].byTask).toEqual([]);

    const sameTask = [
      {
        id: 'a',
        task: 'finish voice ai post',
        startMs: now.getTime() - 50 * 60_000,
        endMs: now.getTime() - 25 * 60_000,
        minutes: 25,
        planned: 25,
        ended: 'completed' as const,
      },
      {
        id: 'b',
        task: 'finish voice ai post',
        startMs: now.getTime() - 20 * 60_000,
        endMs: now.getTime() - 2 * 60_000,
        minutes: 18,
        planned: 25,
        ended: 'ended-early' as const,
      },
    ];
    expect(taskTotals(sameTask)).toEqual([{ task: 'finish voice ai post', minutes: 43 }]);
    expect(groupFocusLog(sameTask, now)[0].heading).toBe('Today, 43m focused');
  });

  it('formats ranges, early minutes, and has no em dashes', () => {
    const start = new Date(2026, 9, 22, 14, 10, 0, 0);
    const end = new Date(2026, 9, 22, 14, 35, 0, 0);
    expect(formatLogRange(start, end)).toBe('2:10-2:35pm');
    expect(formatLogRange(new Date(2026, 9, 22, 11, 50), new Date(2026, 9, 22, 12, 15))).toBe(
      '11:50am-12:15pm'
    );
    expect(formatLogRange(new Date(2026, 9, 22, 21, 1, 10), new Date(2026, 9, 22, 21, 1, 40))).toBe(
      '9:01pm'
    );
    expect(formatFocusedMinutes(25, 25, 'completed')).toBe('25 min');
    expect(formatFocusedMinutes(18, 25, 'ended-early')).toBe('18 of 25 min');
    expect(formatFocusedMinutes(18, 50, 'ended-session')).toBe('18 of 50 min');
    expect(formatFocusedMinutes(20 / 60, 25, 'ended-early')).toBe('<1 min');
    expect(formatDayFocused(20 / 60)).toBe('<1m');
    expect(formatDayFocused(95)).toBe('1h 35m');
    expect(formatLogDayHeading('Today', 95)).toBe('Today, 1h 35m focused');
    expect(dayLabel(now, now)).toBe('Today');
    expect(dayLabel(new Date(2026, 9, 21), now)).toBe('Yesterday');
    expect(taskTotals(getFocusLogFixture(now).filter((entry) => entry.id.startsWith('today-')))).toHaveLength(
      3
    );
    const copy = [
      LOG_LABEL,
      LOG_EMPTY,
      LOG_ENDED_EARLY,
      CLEAR_LOG_LABEL,
      CLEAR_LOG_PROMPT,
      DELETE_LOG_PROMPT,
    ].join(' ');
    expect(copy).not.toMatch(/[—–]/);
  });
});
