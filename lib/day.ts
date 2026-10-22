import { CalendarEvent } from './calendar';

export const MERGE_GAP_MINUTES = 5;
export const HEADS_UP_MINUTES = 5;
export const SMART_FOCUS_BUFFER_MINUTES = 5;
export const SMART_FOCUS_MIN_MINUTES = 10;
export const NUDGE_MIN_GAP_MINUTES = 25;
export const NUDGE_WINDOW_MINUTES = 3;

export type DayState = 'free' | 'in-meeting' | 'in-run';

export interface BusyBlock {
  start: Date;
  end: Date;
  events: CalendarEvent[];
}

export interface FreeGap {
  start: Date;
  end: Date | null;
}

export interface DayModel {
  events: CalendarEvent[];
  busy: BusyBlock[];
  gaps: FreeGap[];
  state: DayState;
  currentEvent: CalendarEvent | null;
  currentRun: BusyBlock | null;
  nextEvent: CalendarEvent | null;
  nextBusy: BusyBlock | null;
  nextFreeGap: FreeGap | null;
  remainingInRun: CalendarEvent[];
  gapMinutes: number | null;
}

export function startOfDay(now: Date): Date {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function endOfDay(now: Date): Date {
  const d = new Date(now);
  d.setHours(23, 59, 59, 999);
  return d;
}

export function minutesBetween(a: Date, b: Date): number {
  return (b.getTime() - a.getTime()) / (1000 * 60);
}

export function isSkippedEvent(event: CalendarEvent): boolean {
  if (event.isAllDay) return true;
  if (event.declined) return true;
  if (event.status === 'cancelled') return true;
  if (event.transparency === 'transparent') return true;
  return false;
}

export function filterDayEvents(events: CalendarEvent[], now: Date): CalendarEvent[] {
  const sod = startOfDay(now);
  const eod = endOfDay(now);

  return events
    .filter((event) => !isSkippedEvent(event))
    .filter((event) => event.end > sod && event.start < eod)
    .sort((a, b) => a.start.getTime() - b.start.getTime());
}

export function mergeBusyBlocks(
  events: CalendarEvent[],
  mergeGapMinutes: number = MERGE_GAP_MINUTES
): BusyBlock[] {
  if (events.length === 0) return [];

  const sorted = [...events].sort((a, b) => a.start.getTime() - b.start.getTime());
  const blocks: BusyBlock[] = [];
  let current: BusyBlock = {
    start: sorted[0].start,
    end: sorted[0].end,
    events: [sorted[0]],
  };

  for (let i = 1; i < sorted.length; i++) {
    const event = sorted[i];
    const gap = minutesBetween(current.end, event.start);
    if (gap < mergeGapMinutes) {
      current.events.push(event);
      if (event.end > current.end) current.end = event.end;
    } else {
      blocks.push(current);
      current = { start: event.start, end: event.end, events: [event] };
    }
  }

  blocks.push(current);
  return blocks;
}

export function buildFreeGaps(busy: BusyBlock[], now: Date): FreeGap[] {
  const sod = startOfDay(now);
  const eod = endOfDay(now);
  const gaps: FreeGap[] = [];

  let cursor = sod;
  for (const block of busy) {
    if (block.start > cursor) {
      gaps.push({ start: cursor, end: block.start });
    }
    if (block.end > cursor) cursor = block.end;
  }

  if (cursor < eod) {
    gaps.push({ start: cursor, end: null });
  }

  return gaps;
}

export function remainingMeetingsInRun(block: BusyBlock | null, now: Date): CalendarEvent[] {
  if (!block) return [];
  return block.events.filter((event) => event.end > now);
}

export function buildDayModel(events: CalendarEvent[], now: Date): DayModel {
  const dayEvents = filterDayEvents(events, now);
  const busy = mergeBusyBlocks(dayEvents);
  const gaps = buildFreeGaps(busy, now);

  const currentRun = busy.find((block) => block.start <= now && now < block.end) ?? null;
  const currentEvent =
    currentRun?.events.find((event) => event.start <= now && now < event.end) ?? null;

  const state: DayState = currentRun
    ? currentRun.events.length >= 2
      ? 'in-run'
      : 'in-meeting'
    : 'free';

  const nextBusy = busy.find((block) => block.start > now) ?? null;
  const nextEvent =
    dayEvents.find((event) => event.start > now) ?? null;

  const nextFreeGap =
    gaps.find((gap) => {
      if (now < gap.start) return true;
      if (gap.end === null) return now >= gap.start;
      return now >= gap.start && now < gap.end;
    }) ?? null;

  // When busy, the next free gap is the one that starts at/after the current block ends
  const nextFreeWhenBusy =
    currentRun
      ? gaps.find((gap) => gap.start >= currentRun.end) ??
        (gaps.find((gap) => gap.start.getTime() === currentRun.end.getTime()) ?? null)
      : nextFreeGap;

  const remainingInRun = remainingMeetingsInRun(currentRun, now);

  let gapMinutes: number | null = null;
  if (state === 'free' && nextEvent) {
    gapMinutes = minutesBetween(now, nextEvent.start);
  } else if (state === 'free') {
    gapMinutes = minutesBetween(now, endOfDay(now));
  }

  return {
    events: dayEvents,
    busy,
    gaps,
    state,
    currentEvent,
    currentRun,
    nextEvent,
    nextBusy,
    nextFreeGap: currentRun ? nextFreeWhenBusy : nextFreeGap,
    remainingInRun,
    gapMinutes,
  };
}

export function formatClock(date: Date): string {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const hour12 = hours % 12 || 12;
  return `${hour12}:${String(minutes).padStart(2, '0')}`;
}

export function formatClockRange(start: Date, end: Date): string {
  return `${formatClock(start)}-${formatClock(end)}`;
}

export function isHeadsUp(model: DayModel, now: Date): boolean {
  if (model.state !== 'free' || !model.nextEvent) return false;
  const minutes = minutesBetween(now, model.nextEvent.start);
  return minutes > 0 && minutes <= HEADS_UP_MINUTES;
}

export function statusLineText(model: DayModel, now: Date): string {
  if (isHeadsUp(model, now) && model.nextEvent) {
    const minutes = Math.max(1, Math.ceil(minutesBetween(now, model.nextEvent.start)));
    return `${model.nextEvent.summary} in ${minutes} min.`;
  }

  if (model.state === 'in-run' && model.currentEvent && model.currentRun) {
    return `In ${model.currentEvent.summary}. Free at ${formatClock(model.currentRun.end)}.`;
  }

  if (model.state === 'in-meeting' && model.currentEvent) {
    return `In ${model.currentEvent.summary}. Free at ${formatClock(model.currentEvent.end)}.`;
  }

  const after = afterMeetingNudge(model, now);
  if (after) return after.text;

  if (!model.nextBusy) {
    return 'Clear for the rest of the day.';
  }

  return `Free until ${formatClock(model.nextBusy.start)}.`;
}

export function focusingLine(minutesLeft: number): string {
  return `Focusing. ${Math.max(0, Math.floor(minutesLeft))} min left.`;
}

export const DEFAULT_FOCUS_MINUTES = 50;

export function orbClickMinutes(model: DayModel, now: Date): number | null {
  if (model.state !== 'free') return null;
  if (isHeadsUp(model, now)) return null;
  const smart = smartFocusOption(now, model.nextEvent?.start ?? null);
  if (smart) return smart.minutes;
  if (!model.nextEvent) return DEFAULT_FOCUS_MINUTES;
  return null;
}

export function hoverDetailText(model: DayModel, now: Date): string {
  const upcoming = model.events.filter((event) => event.end > now).slice(0, 3);
  if (upcoming.length === 0) return '';
  return upcoming.map((event) => `${formatClock(event.start)} ${event.summary}`).join(' / ');
}

/**
 * Gap-aware starting density. Only scales keep probability at scatter 0;
 * existing scatter math still applies on top.
 *
 * >= 90 min → 1.0, 30 min → 0.70, <= 15 min → 0.45
 */
export function gapDensity(gapMinutes: number | null): number {
  if (gapMinutes === null) return 1;
  if (gapMinutes <= 15) return 0.45;
  if (gapMinutes >= 90) return 1;
  if (gapMinutes <= 30) {
    return 0.45 + (0.7 - 0.45) * ((gapMinutes - 15) / 15);
  }
  return 0.7 + (1 - 0.7) * ((gapMinutes - 30) / 60);
}

export function densityForModel(model: DayModel): number {
  if (model.state === 'in-meeting' || model.state === 'in-run') {
    return 0.45;
  }
  return gapDensity(model.gapMinutes);
}

export interface SmartFocusOption {
  end: Date;
  minutes: number;
}

export function smartFocusOption(now: Date, nextMeetingStart: Date | null): SmartFocusOption | null {
  if (!nextMeetingStart) return null;

  const targetEnd = new Date(
    nextMeetingStart.getTime() - SMART_FOCUS_BUFFER_MINUTES * 60 * 1000
  );
  const rawMinutes = minutesBetween(now, targetEnd);
  const minutes = Math.floor(rawMinutes / 5) * 5;

  if (minutes < SMART_FOCUS_MIN_MINUTES) return null;

  return {
    end: new Date(now.getTime() + minutes * 60 * 1000),
    minutes,
  };
}

export function formatCompactDuration(minutes: number): string {
  const mins = Math.max(0, Math.floor(minutes));
  const hours = Math.floor(mins / 60);
  const rem = mins % 60;
  if (hours > 0) return rem > 0 ? `${hours}h ${rem}m` : `${hours}h`;
  return `${mins}m`;
}

export interface AfterMeetingNudge {
  text: string;
  focus: SmartFocusOption;
  endedEvent: CalendarEvent;
}

export function afterMeetingNudge(model: DayModel, now: Date): AfterMeetingNudge | null {
  if (model.state !== 'free') return null;

  const ended = [...model.events]
    .filter((event) => event.end.getTime() <= now.getTime())
    .sort((a, b) => b.end.getTime() - a.end.getTime())[0];

  if (!ended) return null;

  const minutesSinceEnd = minutesBetween(ended.end, now);
  if (minutesSinceEnd < 0 || minutesSinceEnd > NUDGE_WINDOW_MINUTES) return null;

  if (!model.nextEvent) {
    const focus =
      smartFocusOption(now, endOfDay(now)) ?? {
        end: new Date(now.getTime() + DEFAULT_FOCUS_MINUTES * 60 * 1000),
        minutes: DEFAULT_FOCUS_MINUTES,
      };
    return {
      text: 'Clear for the rest of the day.',
      focus,
      endedEvent: ended,
    };
  }

  const gap = minutesBetween(now, model.nextEvent.start);
  if (gap < NUDGE_MIN_GAP_MINUTES) return null;

  const focus = smartFocusOption(now, model.nextEvent.start);
  if (!focus) return null;

  return {
    text: `Free for ${formatCompactDuration(gap)}.`,
    focus,
    endedEvent: ended,
  };
}

const JOIN_URL_RE =
  /https?:\/\/[^\s<>"']*(?:meet\.google\.com|zoom\.us|teams\.microsoft\.com|teams\.live\.com)[^\s<>"']*/i;

export function extractJoinUrl(event: CalendarEvent | null | undefined): string | null {
  if (!event) return null;
  if (event.hangoutLink) return event.hangoutLink;
  if (event.conferenceUri) return event.conferenceUri;

  const haystack = [event.location, event.description].filter(Boolean).join('\n');
  const match = haystack.match(JOIN_URL_RE);
  return match ? match[0] : null;
}
