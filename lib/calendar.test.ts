import { describe, it, expect, beforeEach, vi } from 'vitest';
import { parseICS, expandRecurringEvents, findNextEvent } from './calendar';

describe('parseICS', () => {
  it('parses a simple event', () => {
    const ics = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
DTSTART:20261008T140000Z
DTEND:20261008T150000Z
SUMMARY:Team Meeting
END:VEVENT
END:VCALENDAR`;

    const events = parseICS(ics);
    expect(events).toHaveLength(1);
    expect(events[0].summary).toBe('Team Meeting');
    expect(events[0].start).toEqual(new Date('2026-10-08T14:00:00Z'));
    expect(events[0].end).toEqual(new Date('2026-10-08T15:00:00Z'));
    expect(events[0].isAllDay).toBe(false);
  });

  it('parses all-day events', () => {
    const ics = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
DTSTART;VALUE=DATE:20261008
DTEND;VALUE=DATE:20261009
SUMMARY:All Day Event
END:VEVENT
END:VCALENDAR`;

    const events = parseICS(ics);
    expect(events).toHaveLength(1);
    expect(events[0].isAllDay).toBe(true);
  });

  it('parses recurring events with RRULE', () => {
    const ics = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
DTSTART:20261008T100000Z
DTEND:20261008T110000Z
SUMMARY:Daily Standup
RRULE:FREQ=DAILY;COUNT=5
END:VEVENT
END:VCALENDAR`;

    const events = parseICS(ics);
    expect(events).toHaveLength(1);
    expect(events[0].rrule).toBe('FREQ=DAILY;COUNT=5');
  });

  it('handles line folding', () => {
    const ics = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
DTSTART:20261008T140000Z
DTEND:20261008T150000Z
SUMMARY:This is a very long summary that spans
  multiple lines due to line folding
END:VEVENT
END:VCALENDAR`;

    const events = parseICS(ics);
    expect(events[0].summary).toContain('This is a very long summary');
  });

  it('parses transparent, cancelled, location, and description', () => {
    const ics = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
DTSTART:20261008T140000Z
DTEND:20261008T150000Z
SUMMARY:Hold
TRANSP:TRANSPARENT
STATUS:CANCELLED
LOCATION:https://zoom.us/j/123
DESCRIPTION:Join here
END:VEVENT
END:VCALENDAR`;

    const events = parseICS(ics);
    expect(events[0].transparency).toBe('transparent');
    expect(events[0].status).toBe('cancelled');
    expect(events[0].location).toBe('https://zoom.us/j/123');
    expect(events[0].description).toBe('Join here');
  });

  it('handles escaped characters in summary', () => {
    const ics = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
DTSTART:20261008T140000Z
DTEND:20261008T150000Z
SUMMARY:Meeting\\, with comma\\; and semicolon
END:VEVENT
END:VCALENDAR`;

    const events = parseICS(ics);
    expect(events[0].summary).toBe('Meeting, with comma; and semicolon');
  });
});

describe('expandRecurringEvents', () => {
  beforeEach(() => {
    // Mock current time to 2026-10-08 00:00:00
    vi.setSystemTime(new Date('2026-10-08T00:00:00Z'));
  });

  it('keeps non-recurring events as-is', () => {
    const events = [{
      summary: 'One-time meeting',
      start: new Date('2026-10-08T14:00:00Z'),
      end: new Date('2026-10-08T15:00:00Z'),
      isAllDay: false,
    }];

    const expanded = expandRecurringEvents(events);
    expect(expanded).toHaveLength(1);
    expect(expanded[0].summary).toBe('One-time meeting');
  });

  it('expands daily recurring events', () => {
    const events = [{
      summary: 'Daily standup',
      start: new Date('2026-10-08T10:00:00Z'),
      end: new Date('2026-10-08T10:30:00Z'),
      isAllDay: false,
      rrule: 'FREQ=DAILY;COUNT=3',
    }];

    const expanded = expandRecurringEvents(events);
    expect(expanded.length).toBeGreaterThanOrEqual(3);
    
    // Check first occurrence
    expect(expanded[0].start).toEqual(new Date('2026-10-08T10:00:00Z'));
    
    // Check second occurrence (next day)
    expect(expanded[1].start).toEqual(new Date('2026-10-09T10:00:00Z'));
  });

  it('expands weekly recurring events', () => {
    const events = [{
      summary: 'Weekly meeting',
      start: new Date('2026-10-08T14:00:00Z'),
      end: new Date('2026-10-08T15:00:00Z'),
      isAllDay: false,
      rrule: 'FREQ=WEEKLY;COUNT=2',
    }];

    const expanded = expandRecurringEvents(events);
    expect(expanded.length).toBeGreaterThanOrEqual(2);
    
    // Check first occurrence
    expect(expanded[0].start).toEqual(new Date('2026-10-08T14:00:00Z'));
    
    // Check second occurrence (next week)
    expect(expanded[1].start).toEqual(new Date('2026-10-15T14:00:00Z'));
  });

  it('respects UNTIL date in RRULE', () => {
    const events = [{
      summary: 'Limited recurring',
      start: new Date('2026-10-08T10:00:00Z'),
      end: new Date('2026-10-08T11:00:00Z'),
      isAllDay: false,
      rrule: 'FREQ=DAILY;UNTIL=20261010T000000Z',
    }];

    const expanded = expandRecurringEvents(events);
    // Should have events for Oct 8, 9, 10 only
    expect(expanded.length).toBeLessThanOrEqual(3);
  });
});

describe('findNextEvent', () => {
  beforeEach(() => {
    // Mock current time to 2026-10-08 12:00:00
    vi.setSystemTime(new Date('2026-10-08T12:00:00Z'));
  });

  it('finds the next upcoming event', () => {
    const events = [
      {
        summary: 'Later meeting',
        start: new Date('2026-10-08T16:00:00Z'),
        end: new Date('2026-10-08T17:00:00Z'),
        isAllDay: false,
      },
      {
        summary: 'Sooner meeting',
        start: new Date('2026-10-08T14:00:00Z'),
        end: new Date('2026-10-08T15:00:00Z'),
        isAllDay: false,
      },
    ];

    const next = findNextEvent(events);
    expect(next).not.toBeNull();
    expect(next?.summary).toBe('Sooner meeting');
    expect(next?.minutesToStart).toBeCloseTo(120, 0); // 2 hours = 120 min
  });

  it('ignores all-day events', () => {
    const events = [
      {
        summary: 'All day event',
        start: new Date('2026-10-08T00:00:00Z'),
        end: new Date('2026-10-09T00:00:00Z'),
        isAllDay: true,
      },
      {
        summary: 'Timed event',
        start: new Date('2026-10-08T14:00:00Z'),
        end: new Date('2026-10-08T15:00:00Z'),
        isAllDay: false,
      },
    ];

    const next = findNextEvent(events);
    expect(next?.summary).toBe('Timed event');
  });

  it('ignores past events', () => {
    const events = [
      {
        summary: 'Past meeting',
        start: new Date('2026-10-08T10:00:00Z'),
        end: new Date('2026-10-08T11:00:00Z'),
        isAllDay: false,
      },
      {
        summary: 'Future meeting',
        start: new Date('2026-10-08T14:00:00Z'),
        end: new Date('2026-10-08T15:00:00Z'),
        isAllDay: false,
      },
    ];

    const next = findNextEvent(events);
    expect(next?.summary).toBe('Future meeting');
  });

  it('returns null when no upcoming events', () => {
    const events = [
      {
        summary: 'Past meeting',
        start: new Date('2026-10-08T10:00:00Z'),
        end: new Date('2026-10-08T11:00:00Z'),
        isAllDay: false,
      },
    ];

    const next = findNextEvent(events);
    expect(next).toBeNull();
  });
});
