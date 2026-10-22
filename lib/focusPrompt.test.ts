import { describe, it, expect, beforeEach } from 'vitest';
import { buildDayModel } from './day';
import { getMockEvents, parseNowParam } from './fixtures';
import {
  ASK_PROMPT,
  BREAK_MINUTES,
  capDuration,
  END_EARLY_PROMPT,
  END_SESSION_LABEL,
  END_SESSION_PROMPT,
  KEEP_RESTING_LABEL,
  FALLBACK_TASK,
  MENU_ASK_HINT,
  formatBreakCopy,
  formatCompleted,
  formatFocusingCopy,
  formatMeetingSoonCopy,
  formatMiniFocusStatus,
  KEEP_GOING_LABEL,
  LAST_DURATION_KEY,
  loadLastDuration,
  loadRecentTasks,
  promptSurface,
  rememberTask,
  resolveDuration,
  resolveStartTask,
  visibleAskSuggestions,
  RECENT_TASKS_KEY,
  saveLastDuration,
  saveRecentTasks,
  shortTask,
  untilMeetingDuration,
} from './focusPrompt';

function pinned(hhmm: string): Date {
  return parseNowParam(hhmm, new Date(2026, 9, 9));
}

function modelFor(scenario: Parameters<typeof getMockEvents>[0], hhmm: string) {
  const now = pinned(hhmm);
  return { now, model: buildDayModel(getMockEvents(scenario, now), now) };
}

describe('rememberTask', () => {
  it('keeps the last five unique tasks, newest first', () => {
    let tasks: string[] = [];
    for (const name of ['Write', 'Email', 'Review', 'Plan', 'Read', 'Ship']) {
      tasks = rememberTask(name, tasks);
    }
    expect(tasks).toEqual(['Ship', 'Read', 'Plan', 'Review', 'Email']);
  });

  it('moves a repeat to the front and skips blank or fallback names', () => {
    expect(rememberTask('  Write  ', ['Email', 'Write'])).toEqual(['Write', 'Email']);
    expect(rememberTask('   ', ['Email'])).toEqual(['Email']);
    expect(rememberTask(FALLBACK_TASK, ['Email'])).toEqual(['Email']);
  });
});

describe('visibleAskSuggestions', () => {
  it('shows up to three unique recents and hides the typed value', () => {
    expect(
      visibleAskSuggestions(
        [
          'finish voice ai post',
          'write the spec',
          'review pr',
          'ship',
          'finish voice ai post',
        ],
        ''
      )
    ).toEqual(['finish voice ai post', 'write the spec', 'review pr']);
    expect(
      visibleAskSuggestions(
        ['finish voice ai post', 'write the spec', 'review pr'],
        'finish voice ai post'
      )
    ).toEqual(['write the spec', 'review pr']);
  });
});

describe('resolveStartTask', () => {
  it('uses typed text, then last task, then the most recent suggestion, then Focus', () => {
    expect(resolveStartTask('  Draft  ', 'finish voice ai post', ['older'])).toBe(
      'Draft'
    );
    expect(resolveStartTask('', 'finish voice ai post', ['older'])).toBe(
      'finish voice ai post'
    );
    expect(resolveStartTask('   ', '', ['write the spec', 'review pr'])).toBe(
      'write the spec'
    );
    expect(resolveStartTask('', '', [])).toBe(FALLBACK_TASK);
  });
});

describe('recent task storage', () => {
  beforeEach(() => {
    localStorage.removeItem(RECENT_TASKS_KEY);
    localStorage.removeItem(LAST_DURATION_KEY);
  });

  it('round-trips recent tasks and last duration', () => {
    saveRecentTasks(['Write', 'Email']);
    expect(loadRecentTasks()).toEqual(['Write', 'Email']);
    saveLastDuration('until');
    expect(loadLastDuration()).toBe('until');
    saveLastDuration(50);
    expect(loadLastDuration()).toBe(50);
  });
});

describe('until meeting duration and caps', () => {
  it('uses the free gap and will not pass the next meeting', () => {
    const { model } = modelFor('open-afternoon', '11:00');
    expect(untilMeetingDuration(model)).toBe(240);
    expect(capDuration(90, 40)).toBe(40);
    expect(capDuration(25, 240)).toBe(25);
    expect(resolveDuration(50, 40)).toBe(40);
    expect(resolveDuration('until', 240)).toBe(240);
    expect(resolveDuration(null, null)).toBe(50);
  });

  it('hides until-next when there is no later meeting', () => {
    const { model } = modelFor('empty', '11:00');
    expect(untilMeetingDuration(model)).toBeNull();
  });
});

describe('copy', () => {
  it('formats focusing, completed, break, and meeting-soon lines without em dashes', () => {
    expect(formatFocusingCopy('Deep work', 32)).toEqual({
      task: 'Deep work',
      countdown: '32m left',
    });
    expect(formatFocusingCopy('Deep work', 32.4).countdown).toBe('33m left');
    expect(formatCompleted(50, 'Deep work')).toBe('Focused 50 of 50 min on Deep work');
    expect(formatCompleted(18, 'Write the spec', 50)).toBe(
      'Focused 18 of 50 min on Write the spec'
    );
    expect(formatBreakCopy(4.2)).toBe('Break 5m');
    expect(formatBreakCopy(5)).toBe('Break 5m');
    expect(formatMeetingSoonCopy(4.2)).toBe('Meeting in 5m');
    expect(ASK_PROMPT).not.toMatch(/[—–]/);
    expect(END_EARLY_PROMPT).not.toMatch(/[—–]/);
    expect(END_SESSION_PROMPT).toBe('End session?');
    expect(END_SESSION_LABEL).toBe('End session');
    expect(KEEP_RESTING_LABEL).toBe('Keep resting');
    expect(END_SESSION_PROMPT).not.toMatch(/[—–]/);
    expect(END_SESSION_LABEL).not.toMatch(/[—–]/);
    expect(MENU_ASK_HINT).toBe('← → to choose, Enter to start');
    expect(MENU_ASK_HINT).not.toMatch(/[—–]/);
    expect(KEEP_GOING_LABEL).not.toMatch(/[—–]/);
    expect(formatCompleted(50, 'Deep work')).not.toMatch(/[—–]/);
  });

  it('puts the task and countdown on the mini status', () => {
    expect(
      formatMiniFocusStatus({
        surface: 'focusing',
        task: 'Deep work',
        minutes: 32,
      })
    ).toBe('Deep work 32m');
    expect(formatMiniFocusStatus({ surface: 'stop-confirm' })).toBe('End early?');
    expect(formatMiniFocusStatus({ surface: 'session-confirm' })).toBe('End session?');
    expect(formatMiniFocusStatus({ surface: 'break', minutes: 5 })).toBe('Break 5m');
    expect(shortTask('A very long planning session')).toBe('A very long pla…');
  });
});

describe('promptSurface', () => {
  it('asks when free, yields to meetings, and prefers the focus states', () => {
    expect(
      promptSurface({
        isFocusing: false,
        isBreak: false,
        stopConfirm: false,
        completed: false,
        headsUp: false,
        dayState: 'free',
      })
    ).toBe('ask');
    expect(
      promptSurface({
        isFocusing: false,
        isBreak: false,
        stopConfirm: false,
        completed: false,
        headsUp: true,
        dayState: 'free',
      })
    ).toBe('meeting-soon');
    expect(
      promptSurface({
        isFocusing: false,
        isBreak: false,
        stopConfirm: false,
        completed: false,
        headsUp: true,
        skipHeadsUp: true,
        dayState: 'free',
      })
    ).toBe('ask');
    expect(
      promptSurface({
        isFocusing: false,
        isBreak: false,
        stopConfirm: false,
        completed: false,
        headsUp: false,
        dayState: 'in-meeting',
      })
    ).toBe('in-meeting');
    expect(
      promptSurface({
        isFocusing: true,
        isBreak: false,
        stopConfirm: true,
        completed: false,
        headsUp: false,
        dayState: 'free',
      })
    ).toBe('stop-confirm');
    expect(
      promptSurface({
        isFocusing: false,
        isBreak: true,
        stopConfirm: false,
        completed: false,
        headsUp: false,
        dayState: 'free',
      })
    ).toBe('break');
    expect(
      promptSurface({
        isFocusing: false,
        isBreak: true,
        stopConfirm: false,
        sessionConfirm: true,
        completed: false,
        headsUp: false,
        dayState: 'free',
      })
    ).toBe('session-confirm');
    expect(BREAK_MINUTES).toBe(5);
  });
});
