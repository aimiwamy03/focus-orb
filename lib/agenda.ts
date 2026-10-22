import { CalendarEvent } from './calendar';
import { isSkippedEvent, startOfDay } from './day';
import type { OrbLayout } from './layout';
import type { PromptSurface } from './focusPrompt';
import { AGENDA_ACCENT } from './palette';

export const AGENDA_MIN_WIDTH = 900;
export const AGENDA_WIDTH = 280;
export const AGENDA_LEFT = 24;
export const AGENDA_ORB_PAD = 16;
export const AGENDA_SOFT_ACCENT = AGENDA_ACCENT;
export const AGENDA_EMPTY_TODAY = 'Nothing else today.';
export const AGENDA_EMPTY_TOMORROW = 'Nothing tomorrow.';
export const SHOW_AGENDA_KEY = 'focusOrb:showAgenda';
export const SHOW_AGENDA_LABEL = 'Show agenda';

export type AgendaSectionKey = 'today' | 'tomorrow' | 'nextday';

export interface AgendaItem {
  id: string;
  title: string;
  timeLabel: string;
  color: string;
  isNext: boolean;
  isNow: boolean;
}

export interface AgendaSection {
  key: AgendaSectionKey;
  weekday: string;
  dayNumber: number | null;
  heading: string;
  emptyLabel: string | null;
  items: AgendaItem[];
}

function addDays(now: Date, days: number): Date {
  const next = startOfDay(now);
  next.setDate(next.getDate() + days);
  return next;
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function formatWeekday(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();
}

function period(date: Date): 'am' | 'pm' {
  return date.getHours() >= 12 ? 'pm' : 'am';
}

export function formatAgendaClock(date: Date, withPeriod = false): string {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const hour12 = hours % 12 || 12;
  const time = minutes === 0 ? `${hour12}` : `${hour12}:${String(minutes).padStart(2, '0')}`;
  return withPeriod ? `${time}${period(date)}` : time;
}

export function formatAgendaRange(start: Date, end: Date, now: Date): string {
  if (start.getTime() <= now.getTime() && end.getTime() > now.getTime()) return 'Now';
  const startPeriod = period(start);
  const endPeriod = period(end);
  if (startPeriod === endPeriod) {
    return `${formatAgendaClock(start)}-${formatAgendaClock(end)}${endPeriod}`;
  }
  return `${formatAgendaClock(start, true)}-${formatAgendaClock(end, true)}`;
}

export function eventColor(event: Pick<CalendarEvent, 'backgroundColor'>): string {
  return event.backgroundColor || AGENDA_SOFT_ACCENT;
}

function usableEvents(events: CalendarEvent[]): CalendarEvent[] {
  return events
    .filter((event) => !isSkippedEvent(event))
    .sort((a, b) => a.start.getTime() - b.start.getTime());
}

function itemId(event: CalendarEvent, index: number): string {
  return `${event.summary}-${event.start.getTime()}-${index}`;
}

function toItem(
  event: CalendarEvent,
  now: Date,
  index: number,
  nextStart: number | null
): AgendaItem {
  const isNow = event.start.getTime() <= now.getTime() && event.end.getTime() > now.getTime();
  return {
    id: itemId(event, index),
    title: event.summary,
    timeLabel: formatAgendaRange(event.start, event.end, now),
    color: eventColor(event),
    isNext: nextStart != null && event.start.getTime() === nextStart,
    isNow,
  };
}

function eventsOnDay(events: CalendarEvent[], day: Date): CalendarEvent[] {
  return events.filter((event) => sameDay(event.start, day) || (sameDay(event.end, day) && event.start < addDays(day, 1)));
}

export function remainingToday(events: CalendarEvent[], now: Date): CalendarEvent[] {
  const today = startOfDay(now);
  return usableEvents(events).filter(
    (event) => event.end.getTime() > now.getTime() && event.start < addDays(today, 1)
  );
}

export function buildAgenda(events: CalendarEvent[], now: Date): AgendaSection[] {
  const usable = usableEvents(events);
  const today = startOfDay(now);
  const tomorrow = addDays(now, 1);
  const nextDay = addDays(now, 2);
  const leftover = remainingToday(usable, now);
  const nextStart = leftover.find((event) => event.start.getTime() > now.getTime())?.start.getTime()
    ?? leftover[0]?.start.getTime()
    ?? null;

  const make = (
    key: AgendaSectionKey,
    day: Date,
    dayEvents: CalendarEvent[],
    emptyLabel: string | null
  ): AgendaSection => ({
    key,
    weekday: formatWeekday(day),
    dayNumber: key === 'today' ? day.getDate() : null,
    heading: formatWeekday(day),
    emptyLabel: dayEvents.length === 0 ? emptyLabel : null,
    items: dayEvents.map((event, index) => toItem(event, now, index, nextStart)),
  });

  const todaySection = make('today', today, leftover, AGENDA_EMPTY_TODAY);
  const tomorrowEvents = eventsOnDay(usable, tomorrow);
  const nextEvents = eventsOnDay(usable, nextDay);
  return [
    todaySection,
    make('tomorrow', tomorrow, tomorrowEvents, AGENDA_EMPTY_TOMORROW),
    ...(nextEvents.length > 0 ? [make('nextday', nextDay, nextEvents, null)] : []),
  ];
}

export function visibleAgendaSections(
  sections: AgendaSection[],
  viewH: number
): AgendaSection[] {
  if (viewH >= 720) return sections;
  return sections.filter((section) => section.key !== 'nextday');
}

export function agendaClearsOrb(
  layout: Pick<OrbLayout, 'centerX' | 'radius'>,
  panelRight = AGENDA_LEFT + AGENDA_WIDTH,
  pad = AGENDA_ORB_PAD
): boolean {
  return layout.centerX - layout.radius >= panelRight + pad;
}

export function shouldShowAgenda(input: {
  enabled: boolean;
  surface: PromptSurface | null;
  viewW: number;
  viewH: number;
  chromeVisible: boolean;
  clearsOrb: boolean;
}): boolean {
  if (!input.enabled) return false;
  if (input.viewW < AGENDA_MIN_WIDTH) return false;
  if (!input.clearsOrb) return false;
  if (
    input.surface === 'ask' ||
    input.surface === 'break' ||
    input.surface === 'completed' ||
    input.surface === 'meeting-soon' ||
    input.surface === 'session-confirm'
  ) {
    return true;
  }
  if (input.surface === 'focusing' || input.surface === 'stop-confirm') {
    return input.chromeVisible;
  }
  return false;
}

export function loadShowAgenda(): boolean {
  if (typeof localStorage === 'undefined') return true;
  const raw = localStorage.getItem(SHOW_AGENDA_KEY);
  if (raw == null) return true;
  return raw !== '0';
}

export function saveShowAgenda(value: boolean): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(SHOW_AGENDA_KEY, value ? '1' : '0');
}

export function freeUntilThen(clock: string, title: string): string {
  return `Free until ${clock}, then ${title}.`;
}
