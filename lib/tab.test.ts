import { describe, it, expect } from 'vitest';
import { buildDayModel } from './day';
import { getMockEvents, parseNowParam } from './fixtures';
import { faviconStateFor, formatLiveTabTitle } from './tab';

function pinned(hhmm: string): Date {
  return parseNowParam(hhmm, new Date(2026, 9, 9));
}

function modelFor(scenario: Parameters<typeof getMockEvents>[0], hhmm: string) {
  const now = pinned(hhmm);
  return { now, model: buildDayModel(getMockEvents(scenario, now), now) };
}

describe('formatLiveTabTitle', () => {
  it('open-afternoon is Free 4h', () => {
    const { now, model } = modelFor('open-afternoon', '11:00');
    expect(formatLiveTabTitle(model, now)).toBe('Free 4h');
  });

  it('short-gap is Free 20m', () => {
    const { now, model } = modelFor('short-gap', '13:10');
    expect(formatLiveTabTitle(model, now)).toBe('Free 20m');
  });

  it('upcoming back-to-back is B2B until the run ends', () => {
    const { now, model } = modelFor('back-to-back', '12:00');
    expect(formatLiveTabTitle(model, now)).toBe('B2B until 3:00');
  });

  it('in-meeting is In <title>', () => {
    const { now, model } = modelFor('in-meeting', '13:45');
    expect(formatLiveTabTitle(model, now)).toBe('In Design sync');
  });

  it('pre-meeting heads-up is Join <title>', () => {
    const { now, model } = modelFor('pre-meeting', '13:25');
    expect(formatLiveTabTitle(model, now)).toBe('Join Design sync');
  });

  it('empty is Clear', () => {
    const { now, model } = modelFor('empty', '11:00');
    expect(formatLiveTabTitle(model, now)).toBe('Clear');
  });

  it('during a run is B2B until the run ends', () => {
    const { now, model } = modelFor('back-to-back', '13:45');
    expect(model.state).toBe('in-run');
    expect(formatLiveTabTitle(model, now)).toBe('B2B until 3:00');
  });

  it('manual focus is Focus 18m', () => {
    const { now, model } = modelFor('empty', '11:00');
    expect(
      formatLiveTabTitle(model, now, { isManualFocus: true, focusMinutes: 18.7 })
    ).toBe('Focus 18m');
  });
});

describe('faviconStateFor', () => {
  it('is dense when the orb is tight', () => {
    expect(faviconStateFor({ scatter: 0, state: 'free' })).toBe('dense');
  });

  it('is scattered in the mid ramp', () => {
    expect(faviconStateFor({ scatter: 0.35, state: 'free' })).toBe('scattered');
  });

  it('is dim in a meeting or at the end of the ramp', () => {
    expect(faviconStateFor({ scatter: 1, state: 'in-meeting' })).toBe('dim');
    expect(faviconStateFor({ scatter: 1, state: 'in-run' })).toBe('dim');
    expect(faviconStateFor({ scatter: 0.8, state: 'free' })).toBe('dim');
  });
});
