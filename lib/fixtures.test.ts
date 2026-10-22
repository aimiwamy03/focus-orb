import { describe, it, expect } from 'vitest';
import { buildDayModel, statusLineText, smartFocusOption, formatClock, extractJoinUrl } from './day';
import { getMockEvents, parseNowParam, resolveDemoNow, SAMPLE_DAY_NOW } from './fixtures';

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

describe('resolveDemoNow', () => {
  it('pins mock days to 11:30 unless now is given', () => {
    const base = new Date(2026, 9, 9, 19, 0, 0, 0);
    const pinned = resolveDemoNow(null, 'back-to-back', base);
    expect(SAMPLE_DAY_NOW).toBe('11:30');
    expect(pinned.getHours()).toBe(11);
    expect(pinned.getMinutes()).toBe(30);
    const explicit = resolveDemoNow('13:20', 'pre-meeting', base);
    expect(explicit.getHours()).toBe(13);
    expect(explicit.getMinutes()).toBe(20);
  });
});

describe('mock fixtures', () => {
  it('open-afternoon is a long free stretch', () => {
    const now = parseNowParam('11:00', new Date(2026, 9, 9));
    const model = buildDayModel(getMockEvents('open-afternoon', now), now);
    expect(statusLineText(model, now)).toBe('Free until 3:00.');
    expect(model.gapMinutes).toBe(240);
  });

  it('short-gap is a 20 minute opening before Design sync', () => {
    const now = parseNowParam('13:10', new Date(2026, 9, 9));
    const model = buildDayModel(getMockEvents('short-gap', now), now);
    expect(statusLineText(model, now)).toBe('Free until 1:30.');
    expect(model.gapMinutes).toBe(20);
  });

  it('back-to-back is a 3-meeting run', () => {
    const now = parseNowParam('12:00', new Date(2026, 9, 9));
    const model = buildDayModel(getMockEvents('back-to-back', now), now);
    expect(statusLineText(model, now)).toBe('Free until 1:30.');
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

  it('after the last back-to-back meeting the day is clear, not free-until-midnight', () => {
    const now = parseNowParam('15:00', new Date(2026, 9, 9));
    const model = buildDayModel(getMockEvents('back-to-back', now), now);
    expect(statusLineText(model, now)).toBe('Clear for the rest of the day.');
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
