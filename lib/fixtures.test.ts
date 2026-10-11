import { describe, it, expect } from 'vitest';
import { buildDayModel, statusLineText, smartFocusOption, formatClock, extractJoinUrl } from './day';
import { getMockEvents, parseNowParam } from './fixtures';

describe('parseNowParam', () => {
  it('pins the clock to HH:MM on the given day', () => {
    const base = new Date(2026, 9, 9, 8, 0, 0, 0);
    const pinned = parseNowParam('13:10', base);
    expect(pinned.getHours()).toBe(13);
    expect(pinned.getMinutes()).toBe(10);
    expect(pinned.getFullYear()).toBe(2026);
  });

  it('ignores invalid values', () => {
    const base = new Date(2026, 9, 9, 8, 0, 0, 0);
    expect(parseNowParam('25:00', base).getHours()).toBe(8);
    expect(parseNowParam('nope', base).getHours()).toBe(8);
  });
});

describe('mock fixtures', () => {
  it('open-afternoon is a long free stretch', () => {
    const now = parseNowParam('11:00', new Date(2026, 9, 9));
    const model = buildDayModel(getMockEvents('open-afternoon', now), now);
    expect(statusLineText(model, now)).toBe('Free until 3:00. Click the orb to focus.');
    expect(model.gapMinutes).toBe(240);
  });

  it('short-gap is a 20 minute opening before Design sync', () => {
    const now = parseNowParam('13:10', new Date(2026, 9, 9));
    const model = buildDayModel(getMockEvents('short-gap', now), now);
    expect(statusLineText(model, now)).toBe('Free until 1:30. Click the orb to focus.');
    expect(model.gapMinutes).toBe(20);
  });

  it('back-to-back is a 3-meeting run', () => {
    const now = parseNowParam('12:00', new Date(2026, 9, 9));
    const model = buildDayModel(getMockEvents('back-to-back', now), now);
    expect(statusLineText(model, now)).toBe('Free until 1:30. Click the orb to focus.');
  });

  it('in-meeting uses the isolated-meeting line', () => {
    const now = parseNowParam('13:45', new Date(2026, 9, 9));
    const model = buildDayModel(getMockEvents('in-meeting', now), now);
    expect(statusLineText(model, now)).toBe('In Design sync. Free at 2:00.');
  });

  it('pre-meeting is a heads-up with a Join URL', () => {
    const now = parseNowParam('13:25', new Date(2026, 9, 9));
    const events = getMockEvents('pre-meeting', now);
    const model = buildDayModel(events, now);
    expect(statusLineText(model, now)).toBe('Design sync in 5 min.');
    expect(extractJoinUrl(model.nextEvent)).toBe('https://meet.google.com/abc-defg-hij');
  });

  it('empty is clear', () => {
    const now = parseNowParam('11:00', new Date(2026, 9, 9));
    const model = buildDayModel(getMockEvents('empty', now), now);
    expect(statusLineText(model, now)).toBe('Clear for the rest of the day.');
  });

  it('short-gap at 12:45 offers a 40 minute smart focus', () => {
    const now = parseNowParam('12:45', new Date(2026, 9, 9));
    const model = buildDayModel(getMockEvents('short-gap', now), now);
    const option = smartFocusOption(now, model.nextEvent!.start);
    expect(option?.minutes).toBe(40);
    expect(formatClock(option!.end)).toBe('1:25');
  });
});
