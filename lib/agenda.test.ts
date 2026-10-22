import { describe, expect, it, beforeEach } from 'vitest';
import { CalendarEvent } from './calendar';
import {
  AGENDA_EMPTY_TODAY,
  AGENDA_EMPTY_TOMORROW,
  AGENDA_SOFT_ACCENT,
  agendaClearsOrb,
  buildAgenda,
  formatAgendaRange,
  freeUntilThen,
  loadShowAgenda,
  remainingToday,
  saveShowAgenda,
  shouldShowAgenda,
  SHOW_AGENDA_KEY,
  visibleAgendaSections,
} from './agenda';
import {
  AMY_PRIMARY_CALENDAR_ID,
  AMY_SELF_IMPORT_ID,
  amyImportedWeekCalendars,
  amyImportedWeekNow,
  defaultSelectedCalendarIds,
  getAmyImportedWeekByCalendar,
  mergeEventsFromCalendars,
  parseGoogleDate,
} from './calendars';
import { buildDayModel, statusLineText } from './day';

function at(day: Date, hours: number, minutes = 0): Date {
  const next = new Date(day);
  next.setHours(hours, minutes, 0, 0);
  return next;
}

function ev(
  summary: string,
  start: Date,
  end: Date,
  extra: Partial<CalendarEvent> = {}
): CalendarEvent {
  return { summary, start, end, isAllDay: false, ...extra };
}

const wednesday = new Date(2026, 9, 21, 11, 30, 0, 0);

describe('formatAgendaRange', () => {
  it('uses a hyphen and drops :00, never an en dash', () => {
    expect(formatAgendaRange(at(wednesday, 19, 0), at(wednesday, 20, 0), wednesday)).toBe(
      '7-8pm'
    );
    expect(formatAgendaRange(at(wednesday, 22, 0), at(wednesday, 22, 30), wednesday)).toBe(
      '10-10:30pm'
    );
    expect(formatAgendaRange(at(wednesday, 11, 30), at(wednesday, 12, 30), at(wednesday, 10))).toBe(
      '11:30am-12:30pm'
    );
    expect(formatAgendaRange(at(wednesday, 10, 0), at(wednesday, 10, 30), wednesday)).not.toMatch(
      /[—–]/
    );
  });

  it('labels an event in progress as Now', () => {
    expect(formatAgendaRange(at(wednesday, 11, 0), at(wednesday, 12, 0), wednesday)).toBe('Now');
  });
});

describe('remainingToday and grouping', () => {
  const morning = ev('Standup', at(wednesday, 9), at(wednesday, 9, 30));
  const wrap = ev('Wrap-up', at(wednesday, 15), at(wednesday, 16), {
    backgroundColor: '#4285f4',
  });
  const oneOnOne = ev(
    '1:1',
    at(new Date(2026, 9, 22), 10),
    at(new Date(2026, 9, 22), 10, 30),
    { backgroundColor: '#33b679' }
  );
  const planning = ev(
    'Planning',
    at(new Date(2026, 9, 23), 14),
    at(new Date(2026, 9, 23), 15)
  );
  const declined = ev('Skip me', at(wednesday, 16), at(wednesday, 17), { declined: true });

  it('hides past and skipped events and groups the next two days', () => {
    const leftover = remainingToday(
      [morning, wrap, oneOnOne, planning, declined],
      wednesday
    );
    expect(leftover.map((event) => event.summary)).toEqual(['Wrap-up']);

    const sections = buildAgenda([morning, wrap, oneOnOne, planning, declined], wednesday);
    expect(sections.map((section) => section.key)).toEqual(['today', 'tomorrow', 'nextday']);
    expect(sections[0].weekday).toBe('WEDNESDAY');
    expect(sections[0].dayNumber).toBe(21);
    expect(sections[0].items.map((item) => item.title)).toEqual(['Wrap-up']);
    expect(sections[0].items[0].isNext).toBe(true);
    expect(sections[0].items[0].color).toBe('#4285f4');
    expect(sections[1].heading).toBe('THURSDAY');
    expect(sections[1].items[0].timeLabel).toBe('10-10:30am');
    expect(sections[2].heading).toBe('FRIDAY');
    expect(sections[2].items[0].color).toBe(AGENDA_SOFT_ACCENT);
  });

  it('reads empty today copy when nothing remains and still names tomorrow', () => {
    const sections = buildAgenda([morning], wednesday);
    expect(sections.map((section) => section.key)).toEqual(['today', 'tomorrow']);
    expect(sections[0].emptyLabel).toBe(AGENDA_EMPTY_TODAY);
    expect(sections[0].items).toEqual([]);
    expect(sections[1].heading).toBe('THURSDAY');
    expect(sections[1].emptyLabel).toBe(AGENDA_EMPTY_TOMORROW);
  });

  it('drops the next-day section on a short viewport', () => {
    const sections = buildAgenda([wrap, oneOnOne, planning], wednesday);
    expect(visibleAgendaSections(sections, 900).map((section) => section.key)).toEqual([
      'today',
      'tomorrow',
      'nextday',
    ]);
    expect(visibleAgendaSections(sections, 640).map((section) => section.key)).toEqual([
      'today',
      'tomorrow',
    ]);
  });
});

describe("Amy's imported Thursday week", () => {
  const now = amyImportedWeekNow();
  const calendars = amyImportedWeekCalendars();
  const selected = defaultSelectedCalendarIds(calendars);
  const events = mergeEventsFromCalendars(getAmyImportedWeekByCalendar(now), selected);

  it('selects the imported Self calendar with the primary', () => {
    expect(selected).toEqual([AMY_PRIMARY_CALENDAR_ID, AMY_SELF_IMPORT_ID]);
    expect(events.map((event) => event.summary)).toContain('Production Agent Lab - Workshop');
  });

  it('keeps Thursday as tomorrow with its own heading and the long workshop range', () => {
    const sections = buildAgenda(events, now);
    expect(sections.map((section) => section.key)).toEqual(['today', 'tomorrow', 'nextday']);
    expect(sections[0].emptyLabel).toBe(AGENDA_EMPTY_TODAY);
    expect(sections[1].heading).toBe('THURSDAY');
    expect(sections[1].weekday).toBe('THURSDAY');
    expect(sections[1].items.map((item) => item.title)).toEqual([
      'Production Agent Lab - Workshop',
      'Sleep',
    ]);
    expect(sections[1].items[0].timeLabel).toBe('10am-8pm');
    expect(sections[2].heading).toBe('FRIDAY');
    expect(sections[2].items.map((item) => item.title)).toEqual([
      'Friday standup',
      'Design review',
      'Team sync',
      'recap with myself',
    ]);
  });

  it('does not skip an empty tomorrow just because Friday has events', () => {
    const primaryOnly = mergeEventsFromCalendars(getAmyImportedWeekByCalendar(now), [
      AMY_PRIMARY_CALENDAR_ID,
    ]);
    const sections = buildAgenda(primaryOnly, now);
    expect(sections[1].heading).toBe('THURSDAY');
    expect(sections[1].emptyLabel).toBe(AGENDA_EMPTY_TOMORROW);
    expect(sections[2].heading).toBe('FRIDAY');
  });

  it('includes imported events on the status line when they are today', () => {
    const thursdayMorning = new Date(now);
    thursdayMorning.setDate(now.getDate() + 1);
    thursdayMorning.setHours(9, 0, 0, 0);
    const model = buildDayModel(events, thursdayMorning);
    expect(statusLineText(model, thursdayMorning)).toContain('Production Agent Lab - Workshop');
  });

  it('reads a UTC calendar stamp without an offset as UTC', () => {
    const start = parseGoogleDate({
      dateTime: '2026-10-22T17:00:00',
      timeZone: 'UTC',
    });
    expect(start.toISOString()).toBe('2026-10-22T17:00:00.000Z');
  });
});

describe('visibility and copy', () => {
  it('builds the more specific free-until line', () => {
    expect(freeUntilThen('7:00', 'Design review')).toBe('Free until 7:00, then Design review.');
    expect(freeUntilThen('7:00', 'Design review')).not.toMatch(/[—–]/);
  });

  it('hides under 900px, when it would hit the orb, or during focusing without chrome', () => {
    const base = {
      enabled: true,
      surface: 'ask' as const,
      viewW: 1280,
      viewH: 800,
      chromeVisible: false,
      clearsOrb: true,
    };
    expect(shouldShowAgenda(base)).toBe(true);
    expect(shouldShowAgenda({ ...base, viewW: 880 })).toBe(false);
    expect(shouldShowAgenda({ ...base, clearsOrb: false })).toBe(false);
    expect(shouldShowAgenda({ ...base, enabled: false })).toBe(false);
    expect(shouldShowAgenda({ ...base, surface: 'focusing' })).toBe(false);
    expect(shouldShowAgenda({ ...base, surface: 'focusing', chromeVisible: true })).toBe(true);
    expect(shouldShowAgenda({ ...base, surface: 'completed' })).toBe(true);
    expect(shouldShowAgenda({ ...base, surface: 'meeting-soon' })).toBe(true);
    expect(shouldShowAgenda({ ...base, surface: 'session-confirm' })).toBe(true);
    expect(shouldShowAgenda({ ...base, surface: 'in-meeting' })).toBe(false);
  });

  it('keeps a gap between the panel and the orb', () => {
    expect(agendaClearsOrb({ centerX: 640, radius: 160 })).toBe(true);
    expect(agendaClearsOrb({ centerX: 460, radius: 160 })).toBe(false);
  });
});

describe('show agenda preference', () => {
  beforeEach(() => {
    localStorage.removeItem(SHOW_AGENDA_KEY);
  });

  it('defaults on and round-trips', () => {
    expect(loadShowAgenda()).toBe(true);
    saveShowAgenda(false);
    expect(loadShowAgenda()).toBe(false);
    saveShowAgenda(true);
    expect(loadShowAgenda()).toBe(true);
  });
});
