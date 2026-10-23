import { describe, expect, it, beforeEach } from 'vitest';
import {
  CLEAR_LOG_LABEL,
  CLEAR_LOG_PROMPT,
  FOCUS_LOG_KEY,
  FOCUS_LOG_MOCK_KEY,
  LOG_EMPTY,
  LOG_LABEL,
  LOG_RANGE_DASH,
  clearFocusLog,
  dayLabel,
  deleteFocusLogEntry,
  focusLogKey,
  CHART_EMPTY,
  CHART_TITLE,
  chartBarHeight,
  chartFocusDays,
  formatChartAvg,
  formatChartBest,
  formatChartTooltip,
  formatDayFocused,
  formatFocusedMinutes,
  formatLogRange,
  formatSessionTime,
  getFocusLogChartFixture,
  getFocusLogFixture,
  getFocusLogRedesignFixture,
  groupFocusLog,
  loadFocusLog,
  recordFocusLog,
  saveFocusLog,
  updateFocusLogEntry,
  sessionBarPercent,
  summarizeChart,
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

  it('patches next-step and rating on an existing entry', () => {
    const recorded = recordFocusLog(key, {
      task: 'write the spec',
      startMs: now.getTime() - 25 * 60_000,
      endMs: now.getTime(),
      minutes: 25,
      planned: 25,
      ended: 'completed',
    });
    const updated = updateFocusLogEntry(key, recorded[0].id, {
      nextStep: 'Send the recap',
      focusRating: 4,
      distracted: false,
    });
    expect(updated[0].nextStep).toBe('Send the recap');
    expect(updated[0].focusRating).toBe(4);
    expect(updated[0].distracted).toBe(false);
  });

  it('ignores broken stored JSON', () => {
    localStorage.setItem(key, '{not json');
    expect(loadFocusLog(key)).toEqual([]);
    saveFocusLog(key, []);
    expect(loadFocusLog(key)).toEqual([]);
  });
});

describe('aggregation and copy', () => {
  it('groups Today, Yesterday, then dates, and keeps Today visible when empty', () => {
    const days = groupFocusLog(getFocusLogFixture(now), now);
    expect(days.map((day) => day.label)).toEqual(['Today', 'Yesterday', 'Mon, Oct 19']);
    expect(days[0].heading).toBe('Today');
    expect(days[0].minutes).toBe(95);
    expect(days[0].byTask.map((item) => `${item.task}:${item.minutes}`)).toEqual([
      'write the spec:50',
      'finish voice ai post:25',
      'review pr:20',
    ]);
    expect(days[1].minutes).toBe(140);
    expect(days[2].label).toBe('Mon, Oct 19');
  });

  it('always includes empty Today and never shows other empty days', () => {
    const older = getFocusLogFixture(now).filter((entry) => !entry.id.startsWith('today-'));
    const days = groupFocusLog(older, now);
    expect(days[0].label).toBe('Today');
    expect(days[0].heading).toBe('Today');
    expect(days[0].entries).toEqual([]);
    expect(days.map((day) => day.label)).toEqual(['Today', 'Yesterday', 'Mon, Oct 19']);
    expect(groupFocusLog([], now).map((day) => day.label)).toEqual(['Today']);

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
    expect(groupFocusLog(sameTask, now)[0].minutes).toBe(43);
  });

  it('formats day totals, ranges, and stopped-early labels', () => {
    const start = new Date(2026, 9, 22, 14, 10, 0, 0);
    const end = new Date(2026, 9, 22, 14, 35, 0, 0);
    expect(formatLogRange(start, end)).toBe(`2:10${LOG_RANGE_DASH}2:35pm`);
    expect(formatLogRange(new Date(2026, 9, 22, 11, 50), new Date(2026, 9, 22, 12, 15))).toBe(
      `11:50am${LOG_RANGE_DASH}12:15pm`
    );
    expect(formatLogRange(new Date(2026, 9, 22, 21, 1, 10), new Date(2026, 9, 22, 21, 1, 40))).toBe(
      '9:01pm'
    );
    expect(formatSessionTime(start, end, 'completed')).toBe(`2:10${LOG_RANGE_DASH}2:35pm`);
    expect(formatSessionTime(start, end, 'ended-early')).toBe('2:10pm');
    expect(formatSessionTime(start, end, 'ended-session')).toBe('2:10pm');
    expect(formatFocusedMinutes(25, 25, 'completed')).toBe('25 min');
    expect(formatFocusedMinutes(1, 25, 'ended-early')).toBe('1 min / 25');
    expect(formatFocusedMinutes(18, 50, 'ended-session')).toBe('18 min / 50');
    expect(formatFocusedMinutes(20 / 60, 25, 'ended-early')).toBe('<1 min / 25');
    expect(formatDayFocused(20 / 60)).toBe('<1m');
    expect(formatDayFocused(27)).toBe('27m');
    expect(formatDayFocused(65)).toBe('1h 5m');
    expect(formatDayFocused(95)).toBe('1h 35m');
    expect(sessionBarPercent(1, 25)).toBe(4);
    expect(sessionBarPercent(25, 25)).toBe(100);
    expect(dayLabel(now, now)).toBe('Today');
    expect(dayLabel(new Date(2026, 9, 21), now)).toBe('Yesterday');
    expect(dayLabel(new Date(2026, 9, 19), now)).toBe('Mon, Oct 19');
    expect(taskTotals(getFocusLogFixture(now).filter((entry) => entry.id.startsWith('today-')))).toHaveLength(
      3
    );
    const redesign = groupFocusLog(getFocusLogRedesignFixture(now), now);
    expect(redesign.map((day) => day.label)).toEqual([
      'Today',
      'Yesterday',
      'Tue, Oct 20',
      'Mon, Oct 19',
    ]);
    expect(redesign[0].entries).toEqual([]);
    expect(formatDayFocused(redesign[1].minutes)).toBe('27m');
    expect(formatDayFocused(redesign[2].minutes)).toBe('1h 5m');
    const copy = [
      LOG_LABEL,
      LOG_EMPTY,
      CLEAR_LOG_LABEL,
      CLEAR_LOG_PROMPT,
      CHART_TITLE,
      CHART_EMPTY,
    ].join(' ');
    expect(copy).not.toMatch(/[—–]/);
  });
});

describe('14-day focus chart aggregation', () => {
  it('includes 14 local days ending today, with zeros for empty days', () => {
    const days = chartFocusDays(getFocusLogRedesignFixture(now), now);
    expect(days).toHaveLength(14);
    expect(days[13].isToday).toBe(true);
    expect(days[13].minutes).toBe(0);
    expect(days[12].minutes).toBe(27);
    expect(days[11].minutes).toBe(65);
    expect(days[10].minutes).toBe(25);
    expect(days.filter((day) => day.minutes === 0)).toHaveLength(11);
    expect(days[0].startMs).toBe(new Date(2026, 9, 9).getTime());
    expect(days[13].startMs).toBe(new Date(2026, 9, 22).getTime());
  });

  it('buckets by the local calendar day of startMs, not UTC', () => {
    const beforeMidnight = new Date(2026, 9, 21, 23, 59, 0).getTime();
    const afterMidnight = new Date(2026, 9, 22, 0, 1, 0).getTime();
    const utcStamp = Date.UTC(2026, 9, 22, 3, 0, 0);
    const localOfUtc = new Date(utcStamp);
    const days = chartFocusDays(
      [
        {
          id: 'late',
          task: 'late',
          startMs: beforeMidnight,
          endMs: beforeMidnight + 10 * 60_000,
          minutes: 10,
          planned: 25,
          ended: 'completed',
        },
        {
          id: 'early',
          task: 'early',
          startMs: afterMidnight,
          endMs: afterMidnight + 20 * 60_000,
          minutes: 20,
          planned: 25,
          ended: 'completed',
        },
        {
          id: 'utc',
          task: 'utc',
          startMs: utcStamp,
          endMs: utcStamp + 15 * 60_000,
          minutes: 15,
          planned: 25,
          ended: 'completed',
        },
      ],
      now
    );
    expect(days[12].minutes).toBe(10);
    expect(days[13].minutes).toBe(20 + (localOfUtc.getDate() === 22 ? 15 : 0));
    if (localOfUtc.getDate() !== 22) {
      const bucket = days.find((day) => day.date.getDate() === localOfUtc.getDate());
      expect(bucket?.minutes).toBe(15);
    }
    const utcDay = chartFocusDays(
      [
        {
          id: 'only-utc',
          task: 'only-utc',
          startMs: utcStamp,
          endMs: utcStamp + 15 * 60_000,
          minutes: 15,
          planned: 25,
          ended: 'completed',
        },
      ],
      localOfUtc
    );
    const filled = utcDay.find((day) => day.minutes === 15);
    expect(filled?.date.getFullYear()).toBe(localOfUtc.getFullYear());
    expect(filled?.date.getMonth()).toBe(localOfUtc.getMonth());
    expect(filled?.date.getDate()).toBe(localOfUtc.getDate());
  });

  it('keeps a session just after local midnight on the new day, and ignores days outside the window', () => {
    const justAfterMidnight = new Date(2026, 9, 22, 0, 0, 1).getTime();
    const justBeforeWindow = new Date(2026, 9, 8, 23, 59, 0).getTime();
    const days = chartFocusDays(
      [
        {
          id: 'midnight',
          task: 'midnight',
          startMs: justAfterMidnight,
          endMs: justAfterMidnight + 12 * 60_000,
          minutes: 12,
          planned: 25,
          ended: 'completed',
        },
        {
          id: 'too-old',
          task: 'too old',
          startMs: justBeforeWindow,
          endMs: justBeforeWindow + 30 * 60_000,
          minutes: 30,
          planned: 30,
          ended: 'completed',
        },
      ],
      now
    );
    expect(days[13].minutes).toBe(12);
    expect(days[0].minutes).toBe(0);
    expect(days.every((day) => day.minutes !== 30)).toBe(true);
  });

  it('summarizes totals, session-day averages, and the best day', () => {
    const days = chartFocusDays(getFocusLogChartFixture(now), now);
    const summary = summarizeChart(days);
    expect(summary.hasData).toBe(true);
    expect(summary.total).toBe(25 + 27 + 65 + 25 + 50 + 40 + 90);
    expect(formatDayFocused(summary.total)).toBe('5h 22m');
    expect(formatChartAvg(summary.average)).toBe('Avg 46m a day');
    expect(summary.best?.minutes).toBe(90);
    expect(formatChartBest(summary.best!)).toBe('Best: Sat, Oct 10, 1h 30m');
    expect(formatChartTooltip(new Date(2026, 9, 20), 65)).toBe('Tue, Oct 20 · 1h 5m');
    expect(chartBarHeight(0, 90)).toBe(2);
    expect(chartBarHeight(90, 90)).toBe(140);
    expect(summarizeChart(chartFocusDays([], now)).hasData).toBe(false);
    expect(CHART_TITLE).toBe('Last 14 days');
    expect(CHART_EMPTY).not.toMatch(/[—–]/);
    expect(formatChartTooltip(new Date(2026, 9, 20), 65)).not.toMatch(/[—]/);
  });
});
