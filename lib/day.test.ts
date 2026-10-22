import { describe, it, expect } from 'vitest';
import { CalendarEvent } from './calendar';
import {
  buildDayModel,
  mergeBusyBlocks,
  filterDayEvents,
  isSkippedEvent,
  statusLineText,
  focusingLine,
  orbClickMinutes,
  hoverDetailText,
  gapDensity,
  densityForModel,
  smartFocusOption,
  extractJoinUrl,
  formatClock,
  remainingMeetingsInRun,
  afterMeetingNudge,
} from './day';

function ev(
  summary: string,
  start: Date,
  end: Date,
  extra: Partial<CalendarEvent> = {}
): CalendarEvent {
  return { summary, start, end, isAllDay: false, ...extra };
}

function at(hours: number, minutes: number = 0): Date {
  return new Date(2026, 9, 9, hours, minutes, 0, 0);
}

describe('isSkippedEvent / filterDayEvents', () => {
  it('skips declined events', () => {
    const declined = ev('Nope', at(13, 30), at(14), { declined: true });
    expect(isSkippedEvent(declined)).toBe(true);
    expect(filterDayEvents([declined], at(11))).toHaveLength(0);
  });

  it('skips cancelled events', () => {
    const cancelled = ev('Cancelled', at(13, 30), at(14), { status: 'cancelled' });
    expect(isSkippedEvent(cancelled)).toBe(true);
  });

  it('skips free / transparent events', () => {
    const free = ev('Focus block', at(13, 30), at(14), { transparency: 'transparent' });
    expect(isSkippedEvent(free)).toBe(true);
  });

  it('skips all-day events', () => {
    const allDay = ev('OOO', at(0), at(24), { isAllDay: true });
    expect(isSkippedEvent(allDay)).toBe(true);
  });

  it('keeps confirmed busy timed events', () => {
    const meeting = ev('Design sync', at(13, 30), at(14));
    expect(isSkippedEvent(meeting)).toBe(false);
    expect(filterDayEvents([meeting], at(11))).toHaveLength(1);
  });
});

describe('mergeBusyBlocks / run detection', () => {
  it('merges overlapping events into one block', () => {
    const events = [
      ev('A', at(13, 30), at(14, 15)),
      ev('B', at(14, 0), at(14, 45)),
    ];
    const blocks = mergeBusyBlocks(events);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].events).toHaveLength(2);
    expect(blocks[0].start).toEqual(at(13, 30));
    expect(blocks[0].end).toEqual(at(14, 45));
  });

  it('merges gaps under 5 minutes into one run', () => {
    const events = [
      ev('Design sync', at(13, 30), at(14)),
      ev('Standup', at(14, 4), at(14, 30)),
      ev('Review', at(14, 30), at(15)),
    ];
    const blocks = mergeBusyBlocks(events);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].events.map((e) => e.summary)).toEqual([
      'Design sync',
      'Standup',
      'Review',
    ]);
    expect(blocks[0].end).toEqual(at(15));
  });

  it('does not merge a 5 minute gap', () => {
    const events = [
      ev('A', at(13, 30), at(14)),
      ev('B', at(14, 5), at(14, 30)),
    ];
    const blocks = mergeBusyBlocks(events);
    expect(blocks).toHaveLength(2);
  });

  it('keeps isolated meetings as separate blocks', () => {
    const events = [
      ev('Morning', at(10), at(10, 30)),
      ev('Afternoon', at(15), at(16)),
    ];
    expect(mergeBusyBlocks(events)).toHaveLength(2);
  });
});

describe('buildDayModel', () => {
  const run = [
    ev('Design sync', at(13, 30), at(14)),
    ev('Standup', at(14), at(14, 30)),
    ev('Review', at(14, 30), at(15)),
  ];

  it('detects free state and the next run', () => {
    const model = buildDayModel(run, at(12));
    expect(model.state).toBe('free');
    expect(model.nextBusy?.events).toHaveLength(3);
    expect(model.nextEvent?.summary).toBe('Design sync');
    expect(model.gapMinutes).toBe(90);
  });

  it('detects in-meeting for an isolated event', () => {
    const model = buildDayModel([ev('Design sync', at(13, 30), at(14))], at(13, 45));
    expect(model.state).toBe('in-meeting');
    expect(model.currentEvent?.summary).toBe('Design sync');
    expect(model.currentRun?.events).toHaveLength(1);
  });

  it('detects in-run when inside a merged block', () => {
    const model = buildDayModel(run, at(13, 45));
    expect(model.state).toBe('in-run');
    expect(model.currentEvent?.summary).toBe('Design sync');
    expect(model.currentRun?.end).toEqual(at(15));
  });

  it('returns the next free gap while free', () => {
    const model = buildDayModel(run, at(12));
    expect(model.nextFreeGap?.end).toEqual(at(13, 30));
  });

  it('returns the next free gap after the current run', () => {
    const model = buildDayModel(run, at(13, 45));
    expect(model.nextFreeGap?.start).toEqual(at(15));
    expect(model.nextFreeGap?.end).toBeNull();
  });

  it('counts remaining meetings in the run, including the current one', () => {
    const duringFirst = buildDayModel(run, at(13, 45));
    expect(remainingMeetingsInRun(duringFirst.currentRun, at(13, 45))).toHaveLength(3);
    expect(duringFirst.remainingInRun.map((e) => e.summary)).toEqual([
      'Design sync',
      'Standup',
      'Review',
    ]);

    const duringSecond = buildDayModel(run, at(14, 10));
    expect(duringSecond.remainingInRun).toHaveLength(2);

    const afterLast = buildDayModel(run, at(15, 5));
    expect(afterLast.remainingInRun).toHaveLength(0);
    expect(afterLast.state).toBe('free');
  });

  it('ignores declined, free, and all-day events when building the day', () => {
    const events = [
      ev('All day', at(0), at(23, 59), { isAllDay: true }),
      ev('Declined', at(13, 30), at(14), { declined: true }),
      ev('Hold', at(14), at(15), { transparency: 'transparent' }),
      ev('Real', at(16), at(16, 30)),
    ];
    const model = buildDayModel(events, at(12));
    expect(model.events.map((e) => e.summary)).toEqual(['Real']);
    expect(model.busy).toHaveLength(1);
  });
});

describe('statusLineText', () => {
  it('describes a free stretch before a single meeting', () => {
    const model = buildDayModel([ev('Design sync', at(13, 30), at(14))], at(12));
    expect(statusLineText(model, at(12))).toBe('Free until 1:30, then Design sync.');
  });

  it('describes a free stretch before a back-to-back run', () => {
    const model = buildDayModel(
      [
        ev('Design sync', at(13, 30), at(14)),
        ev('Standup', at(14), at(14, 30)),
        ev('Review', at(14, 30), at(15)),
      ],
      at(12)
    );
    expect(statusLineText(model, at(12))).toBe('Free until 1:30, then Design sync.');
  });

  it('describes an isolated meeting and when you are free', () => {
    const model = buildDayModel(
      [ev('Design sync', at(13, 30), at(14)), ev('Planning', at(15), at(16))],
      at(13, 45)
    );
    expect(statusLineText(model, at(13, 45))).toBe('In Design sync. Free at 2:00.');
  });

  it('uses the in-run line with free-at the end of the run', () => {
    const model = buildDayModel(
      [
        ev('Design sync', at(13, 30), at(14)),
        ev('Standup', at(14), at(14, 30)),
        ev('Review', at(14, 30), at(15)),
      ],
      at(13, 45)
    );
    expect(statusLineText(model, at(13, 45))).toBe('In Design sync. Free at 3:00.');
  });

  it('says the day is clear when nothing remains', () => {
    const model = buildDayModel([], at(11));
    expect(statusLineText(model, at(11))).toBe('Clear for the rest of the day.');
  });

  it('switches to the heads-up join line in the 5-minute window', () => {
    const model = buildDayModel(
      [ev('Design sync', at(13, 30), at(14), { hangoutLink: 'https://meet.google.com/abc-defg-hij' })],
      at(13, 25)
    );
    expect(statusLineText(model, at(13, 25))).toBe('Design sync in 5 min.');
  });
});

describe('orbClickMinutes / focusingLine', () => {
  it('starts focus until the next meeting minus 5 in a short gap', () => {
    const model = buildDayModel([ev('Design sync', at(13, 30), at(14))], at(13, 10));
    expect(orbClickMinutes(model, at(13, 10))).toBe(15);
  });

  it('starts a 50 minute block when the rest of the day is clear', () => {
    expect(orbClickMinutes(buildDayModel([], at(11)), at(11))).toBe(50);
  });

  it('does not start focus during a meeting', () => {
    const model = buildDayModel([ev('Design sync', at(13, 30), at(14))], at(13, 45));
    expect(orbClickMinutes(model, at(13, 45))).toBeNull();
  });

  it('formats the focusing line', () => {
    expect(focusingLine(38.4)).toBe('Focusing. 38 min left.');
  });
});

describe('hoverDetailText', () => {
  it('lists the next two or three events on one line', () => {
    const model = buildDayModel(
      [
        ev('Design sync', at(13, 30), at(14)),
        ev('1:1', at(14), at(14, 30)),
        ev('Review', at(14, 30), at(15)),
      ],
      at(12)
    );
    expect(hoverDetailText(model, at(12))).toBe(
      '1:30 Design sync / 2:00 1:1 / 2:30 Review'
    );
  });

  it('is empty when the day is clear', () => {
    expect(hoverDetailText(buildDayModel([], at(11)), at(11))).toBe('');
  });
});

describe('gapDensity', () => {
  it('is full at 90 minutes and above', () => {
    expect(gapDensity(90)).toBe(1);
    expect(gapDensity(240)).toBe(1);
  });

  it('is ~70% at 30 minutes', () => {
    expect(gapDensity(30)).toBeCloseTo(0.7, 5);
  });

  it('is ~45% at 15 minutes and below', () => {
    expect(gapDensity(15)).toBe(0.45);
    expect(gapDensity(5)).toBe(0.45);
    expect(gapDensity(0)).toBe(0.45);
  });

  it('interpolates between the anchors', () => {
    expect(gapDensity(22.5)).toBeCloseTo(0.575, 5);
    expect(gapDensity(60)).toBeCloseTo(0.85, 5);
  });

  it('treats a clear rest-of-day gap as full density', () => {
    const model = buildDayModel([], at(11));
    expect(densityForModel(model)).toBe(1);
  });

  it('keeps the orb dim during a run', () => {
    const model = buildDayModel(
      [ev('A', at(13, 30), at(14)), ev('B', at(14), at(15))],
      at(13, 45)
    );
    expect(densityForModel(model)).toBe(0.45);
  });
});

describe('smartFocusOption', () => {
  it('offers focus until the next meeting minus a 5 min buffer, rounded down to 5', () => {
    const option = smartFocusOption(at(12, 45), at(13, 30));
    expect(option).not.toBeNull();
    expect(option?.minutes).toBe(40);
    expect(formatClock(option!.end)).toBe('1:25');
  });

  it('hides the option when under 10 minutes', () => {
    expect(smartFocusOption(at(13, 18), at(13, 30))).toBeNull();
    expect(smartFocusOption(at(13, 20), at(13, 30))).toBeNull();
  });

  it('is hidden with no upcoming meeting', () => {
    expect(smartFocusOption(at(12), null)).toBeNull();
  });
});

describe('afterMeetingNudge', () => {
  it('appears when a meeting just ended and the next gap is 25 minutes or more', () => {
    const model = buildDayModel(
      [ev('Review', at(14, 30), at(15)), ev('Wrap-up', at(15, 25), at(16))],
      at(15)
    );
    const nudge = afterMeetingNudge(model, at(15));
    expect(nudge).not.toBeNull();
    expect(nudge?.text).toBe('Free for 25m.');
    expect(nudge?.focus.minutes).toBe(20);
    expect(formatClock(nudge!.focus.end)).toBe('3:20');
  });

  it('does not appear for a 24 minute gap', () => {
    const model = buildDayModel(
      [ev('Review', at(14, 30), at(15)), ev('Wrap-up', at(15, 24), at(16))],
      at(15)
    );
    expect(afterMeetingNudge(model, at(15))).toBeNull();
  });

  it('does not appear more than 3 minutes after the meeting ends', () => {
    const model = buildDayModel([ev('Review', at(14, 30), at(15))], at(15, 4));
    expect(afterMeetingNudge(model, at(15, 4))).toBeNull();
  });

  it('does not appear during a meeting', () => {
    const model = buildDayModel([ev('Design sync', at(13, 30), at(14))], at(13, 45));
    expect(afterMeetingNudge(model, at(13, 45))).toBeNull();
  });

  it('says the day is clear when no later meeting exists', () => {
    const model = buildDayModel(
      [
        ev('Design sync', at(13, 30), at(14)),
        ev('Standup', at(14), at(14, 30)),
        ev('Review', at(14, 30), at(15)),
      ],
      at(15)
    );
    const nudge = afterMeetingNudge(model, at(15));
    expect(nudge).not.toBeNull();
    expect(nudge?.endedEvent.summary).toBe('Review');
    expect(nudge?.text).toBe('Clear for the rest of the day.');
    expect(statusLineText(model, at(15))).toBe('Clear for the rest of the day.');
  });
});

describe('extractJoinUrl', () => {
  it('prefers hangoutLink', () => {
    expect(
      extractJoinUrl(
        ev('Sync', at(13, 30), at(14), { hangoutLink: 'https://meet.google.com/abc-defg-hij' })
      )
    ).toBe('https://meet.google.com/abc-defg-hij');
  });

  it('uses conferenceUri next', () => {
    expect(
      extractJoinUrl(
        ev('Sync', at(13, 30), at(14), { conferenceUri: 'https://zoom.us/j/123' })
      )
    ).toBe('https://zoom.us/j/123');
  });

  it('finds Meet / Zoom / Teams URLs in location or description', () => {
    expect(
      extractJoinUrl(
        ev('Sync', at(13, 30), at(14), {
          location: 'https://teams.microsoft.com/l/meetup-join/19%3ameeting',
        })
      )
    ).toContain('teams.microsoft.com');

    expect(
      extractJoinUrl(
        ev('Sync', at(13, 30), at(14), {
          description: 'Dial in: https://zoom.us/j/999 then hang up',
        })
      )
    ).toBe('https://zoom.us/j/999');
  });
});
