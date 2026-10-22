import { CalendarEvent } from './calendar';

export const MOCK_SCENARIOS = [
  'open-afternoon',
  'short-gap',
  'back-to-back',
  'in-meeting',
  'pre-meeting',
  'empty',
] as const;

export type MockScenario = (typeof MOCK_SCENARIOS)[number];

export function isMockScenario(value: string | null): value is MockScenario {
  return !!value && (MOCK_SCENARIOS as readonly string[]).includes(value);
}

export const SAMPLE_DAY_NOW = '11:30';
export const SAMPLE_DAY_LABEL = 'Sample day';

export function parseNowParam(nowParam: string | null, base: Date = new Date()): Date {
  if (!nowParam) return new Date(base);
  const match = nowParam.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return new Date(base);
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return new Date(base);
  const pinned = new Date(base);
  pinned.setHours(hours, minutes, 0, 0);
  return pinned;
}

export function resolveDemoNow(
  nowParam: string | null,
  mockScenario: string | null,
  base: Date = new Date()
): Date {
  if (nowParam) return parseNowParam(nowParam, base);
  if (mockScenario) return parseNowParam(SAMPLE_DAY_NOW, base);
  return new Date(base);
}

function at(now: Date, hours: number, minutes: number): Date {
  const d = new Date(now);
  d.setHours(hours, minutes, 0, 0);
  return d;
}

function ev(
  now: Date,
  summary: string,
  startH: number,
  startM: number,
  endH: number,
  endM: number,
  extra: Partial<CalendarEvent> = {}
): CalendarEvent {
  return {
    summary,
    start: at(now, startH, startM),
    end: at(now, endH, endM),
    isAllDay: false,
    ...extra,
  };
}

export function getMockEvents(scenario: MockScenario, now: Date): CalendarEvent[] {
  switch (scenario) {
    case 'open-afternoon':
      return [ev(now, 'Wrap-up', 15, 0, 16, 0)];
    case 'short-gap':
      return [ev(now, 'Design sync', 13, 30, 14, 0)];
    case 'back-to-back':
      return [
        ev(now, 'Design sync', 13, 30, 14, 0),
        ev(now, 'Standup', 14, 0, 14, 30),
        ev(now, 'Review', 14, 30, 15, 0),
      ];
    case 'in-meeting':
      return [
        ev(now, 'Design sync', 13, 30, 14, 0),
        ev(now, 'Planning', 15, 0, 16, 0),
      ];
    case 'pre-meeting':
      return [
        ev(now, 'Design sync', 13, 30, 14, 0, {
          hangoutLink: 'https://meet.google.com/abc-defg-hij',
        }),
      ];
    case 'empty':
      return [];
  }
}
