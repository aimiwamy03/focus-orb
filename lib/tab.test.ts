import { describe, it, expect } from 'vitest';
import { buildDayModel } from './day';
import { getMockEvents, parseNowParam } from './fixtures';
import {
  APP_TITLE,
  applyOrbFavicon,
  FAVICON_SIZE,
  faviconStateFor,
  logoLayout,
  LOGO_CORE,
  LOGO_DOT,
  LOGO_DOT_COUNT,
} from './tab';

function pinned(hhmm: string): Date {
  return parseNowParam(hhmm, new Date(2026, 9, 9));
}

function modelFor(scenario: Parameters<typeof getMockEvents>[0], hhmm: string) {
  const now = pinned(hhmm);
  return { now, model: buildDayModel(getMockEvents(scenario, now), now) };
}

describe('document title', () => {
  it('is exactly Focus Orb in idle, focusing, heads-up, sample-day, meeting, and run states', () => {
    const states = [
      modelFor('empty', '11:00'),
      modelFor('open-afternoon', '11:00'),
      modelFor('short-gap', '13:10'),
      modelFor('back-to-back', '12:00'),
      modelFor('in-meeting', '13:45'),
      modelFor('pre-meeting', '13:25'),
      modelFor('back-to-back', '13:45'),
    ];
    expect(states.map(({ model }) => model.state)).toEqual([
      'free',
      'free',
      'free',
      'free',
      'in-meeting',
      'free',
      'in-run',
    ]);
    for (const { model } of states) {
      expect(model).toBeTruthy();
      expect(APP_TITLE).toBe('Focus Orb');
    }
  });
});

describe('faviconStateFor', () => {
  it('is dense when the orb is tight', () => {
    expect(faviconStateFor({ scatter: 0, state: 'free' })).toBe('dense');
  });

  it('glows in logo B style during manual focus', () => {
    expect(faviconStateFor({ scatter: 0, state: 'free', isManualFocus: true })).toBe(
      'focusing'
    );
  });

  it('is scattered in the mid ramp', () => {
    expect(faviconStateFor({ scatter: 0.35, state: 'free' })).toBe('scattered');
  });

  it('is dim in a meeting or at the end of the ramp', () => {
    expect(faviconStateFor({ scatter: 1, state: 'in-meeting' })).toBe('dim');
    expect(faviconStateFor({ scatter: 1, state: 'in-run' })).toBe('dim');
    expect(faviconStateFor({ scatter: 0.8, state: 'free' })).toBe('dim');
  });

  it('still changes as scatter and focus change', () => {
    const idle = faviconStateFor({ scatter: 0, state: 'free' });
    const focus = faviconStateFor({ scatter: 0, state: 'free', isManualFocus: true });
    const soon = faviconStateFor({ scatter: 0.4, state: 'free' });
    const meeting = faviconStateFor({ scatter: 1, state: 'in-meeting' });
    expect(new Set([idle, focus, soon, meeting]).size).toBe(4);
  });
});

describe('logo B favicon layout', () => {
  it('keeps ten ring dots and a centered core in the idle mark', () => {
    const layout = logoLayout(FAVICON_SIZE, 0);
    expect(layout.dots).toHaveLength(LOGO_DOT_COUNT);
    expect(layout.cx).toBe(16);
    expect(layout.cy).toBe(16);
    expect(layout.coreR).toBeCloseTo(4, 5);
    expect(layout.dots[0]?.x).toBeCloseTo(16, 5);
    expect(layout.dots[0]?.y).toBeCloseTo(16 - 300 / 32, 5);
  });

  it('scatters the ring outward before meetings', () => {
    const idle = logoLayout(FAVICON_SIZE, 0);
    const scattered = logoLayout(FAVICON_SIZE, 0.7);
    const idleSpan = Math.hypot(idle.dots[0].x - idle.cx, idle.dots[0].y - idle.cy);
    const scatteredSpan = Math.hypot(
      scattered.dots[0].x - scattered.cx,
      scattered.dots[0].y - scattered.cy
    );
    expect(scatteredSpan).toBeGreaterThan(idleSpan);
  });

  it('uses logo B fills', () => {
    expect(LOGO_CORE).toBe('#80C1E1');
    expect(LOGO_DOT).toBe('#ECECEE');
  });

  it('applies live favicon states onto the icon link', () => {
    document.head.innerHTML = '<link rel="icon" href="/favicon.svg" type="image/svg+xml" />';
    applyOrbFavicon('dense');
    const dense = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    expect(dense?.dataset.orbState).toBe('dense');
    expect(dense?.href.length).toBeGreaterThan(8);
    applyOrbFavicon('focusing');
    expect(document.querySelector<HTMLLinkElement>('link[rel="icon"]')?.dataset.orbState).toBe(
      'focusing'
    );
    applyOrbFavicon('scattered');
    expect(document.querySelector<HTMLLinkElement>('link[rel="icon"]')?.dataset.orbState).toBe(
      'scattered'
    );
  });
});
