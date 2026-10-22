export type VoiceConflictReason = 'calendar' | 'whoop';

export interface VoiceConflictInput {
  minutes: number;
  gapMinutes: number | null;
  nextEventTitle: string | null;
  whoopOfferMinutes: number | null;
}

export interface VoiceConflict {
  reason: VoiceConflictReason;
  minutes: number;
  prompt: string;
}

function floorPositive(value: number | null): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  const minutes = Math.floor(value);
  return minutes >= 1 ? minutes : null;
}

export function formatCalendarConflict(minutes: number, title: string | null): string {
  const name = (title ?? '').trim();
  if (name) return `You have ${minutes} minutes before ${name}. Do ${minutes}?`;
  return `You have ${minutes} minutes free. Do ${minutes}?`;
}

export function formatWhoopConflict(minutes: number): string {
  return `WHOOP suggests ${minutes} minutes. Do ${minutes}?`;
}

export function voiceConflict(input: VoiceConflictInput): VoiceConflict | null {
  const requested = Math.round(input.minutes);
  if (!Number.isFinite(requested) || requested < 1) return null;

  const options: VoiceConflict[] = [];
  const calendarMinutes = floorPositive(input.gapMinutes);
  if (calendarMinutes != null && requested > calendarMinutes) {
    options.push({
      reason: 'calendar',
      minutes: calendarMinutes,
      prompt: formatCalendarConflict(calendarMinutes, input.nextEventTitle),
    });
  }

  const whoopMinutes = floorPositive(input.whoopOfferMinutes);
  if (whoopMinutes != null && requested > whoopMinutes) {
    options.push({
      reason: 'whoop',
      minutes: whoopMinutes,
      prompt: formatWhoopConflict(whoopMinutes),
    });
  }

  if (options.length === 0) return null;
  return options.reduce((shortest, option) =>
    option.minutes < shortest.minutes
      ? option
      : option.minutes === shortest.minutes && option.reason === 'calendar'
        ? option
        : shortest
  );
}
