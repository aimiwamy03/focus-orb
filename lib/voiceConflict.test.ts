import { describe, expect, it } from 'vitest';
import { formatCalendarConflict, voiceConflict } from './voiceConflict';

describe('voiceConflict', () => {
  it('offers the free gap before the next event', () => {
    expect(
      voiceConflict({
        minutes: 40,
        gapMinutes: 30,
        nextEventTitle: 'Standup',
        whoopOfferMinutes: null,
      })
    ).toEqual({
      reason: 'calendar',
      minutes: 30,
      prompt: 'You have 30 minutes before Standup. Do 30?',
    });
  });

  it('offers the WHOOP block when WHOOP is on and shorter', () => {
    expect(
      voiceConflict({
        minutes: 40,
        gapMinutes: 90,
        nextEventTitle: 'Wrap-up',
        whoopOfferMinutes: 25,
      })
    ).toEqual({
      reason: 'whoop',
      minutes: 25,
      prompt: 'WHOOP suggests 25 minutes. Do 25?',
    });
  });

  it('picks the shorter of calendar and WHOOP', () => {
    const conflict = voiceConflict({
      minutes: 50,
      gapMinutes: 30,
      nextEventTitle: 'Standup',
      whoopOfferMinutes: 25,
    });
    expect(conflict?.reason).toBe('whoop');
    expect(conflict?.minutes).toBe(25);
  });

  it('does not conflict when the request fits', () => {
    expect(
      voiceConflict({
        minutes: 25,
        gapMinutes: 40,
        nextEventTitle: 'Standup',
        whoopOfferMinutes: 50,
      })
    ).toBeNull();
  });

  it('formats a gap with no title', () => {
    expect(formatCalendarConflict(20, null)).toBe('You have 20 minutes free. Do 20?');
  });

  it('has no em dashes', () => {
    const prompt = formatCalendarConflict(30, 'Standup');
    expect(prompt).not.toMatch(/[—–]/);
  });
});
