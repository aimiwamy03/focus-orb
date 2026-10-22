import { afterEach, describe, expect, it } from 'vitest';
import {
  INTRO_HINT_COLOR,
  INTRO_LINES,
  INTRO_MIN_CAPTION_PX,
  INTRO_SKIP_HINT,
  INTRO_SOUND_LABEL,
  INTRO_TIMELINE,
  PLAY_INTRO_LABEL,
  introArtZoom,
  introClockSpeed,
  introFrame,
  introNarrow,
  introSoundEvents,
  isIntroSkipKey,
  isStoredFocusRunning,
  loadIntroPlayed,
  loadIntroSound,
  loadPlayIntro,
  markIntroPlayed,
  parseIntroFreeze,
  saveIntroSound,
  savePlayIntro,
  shouldPlayIntro,
} from './intro';
import { MANUAL_FOCUS_KEY } from './useManualFocus';

afterEach(() => {
  sessionStorage.clear();
  localStorage.clear();
});

describe('intro gating', () => {
  it('plays once per browser session and respects the Play intro toggle', () => {
    expect(
      shouldPlayIntro({
        introParam: null,
        sessionPlayed: false,
        playIntro: true,
        focusing: false,
        miniOnly: false,
      })
    ).toBe(true);
    expect(
      shouldPlayIntro({
        introParam: null,
        sessionPlayed: true,
        playIntro: true,
        focusing: false,
        miniOnly: false,
      })
    ).toBe(false);
    expect(
      shouldPlayIntro({
        introParam: null,
        sessionPlayed: false,
        playIntro: false,
        focusing: false,
        miniOnly: false,
      })
    ).toBe(false);
  });

  it('skips while a focus session is running or the mini orb is up', () => {
    expect(
      shouldPlayIntro({
        introParam: null,
        sessionPlayed: false,
        playIntro: true,
        focusing: true,
        miniOnly: false,
      })
    ).toBe(false);
    expect(
      shouldPlayIntro({
        introParam: null,
        sessionPlayed: false,
        playIntro: true,
        focusing: false,
        miniOnly: true,
      })
    ).toBe(false);
  });

  it('honors ?intro=1 and ?intro=0 over prefs and session', () => {
    expect(
      shouldPlayIntro({
        introParam: '1',
        sessionPlayed: true,
        playIntro: false,
        focusing: true,
        miniOnly: false,
      })
    ).toBe(true);
    expect(
      shouldPlayIntro({
        introParam: '0',
        sessionPlayed: false,
        playIntro: true,
        focusing: false,
        miniOnly: false,
      })
    ).toBe(false);
  });

  it('stores session played and toggle defaults', () => {
    expect(loadIntroPlayed()).toBe(false);
    expect(loadPlayIntro()).toBe(true);
    expect(loadIntroSound()).toBe(false);
    markIntroPlayed();
    savePlayIntro(false);
    saveIntroSound(true);
    expect(loadIntroPlayed()).toBe(true);
    expect(loadPlayIntro()).toBe(false);
    expect(loadIntroSound()).toBe(true);
  });

  it('detects a restored focus session from localStorage', () => {
    expect(isStoredFocusRunning()).toBe(false);
    localStorage.setItem(
      MANUAL_FOCUS_KEY,
      JSON.stringify({ startTime: Date.now(), duration: 25, task: 'write', kind: 'focus' })
    );
    expect(isStoredFocusRunning()).toBe(true);
    localStorage.setItem(
      MANUAL_FOCUS_KEY,
      JSON.stringify({ startTime: Date.now() - 40 * 60_000, duration: 25, task: 'write', kind: 'focus' })
    );
    expect(isStoredFocusRunning()).toBe(false);
  });
});

describe('intro timeline', () => {
  it('matches the mock sound mix times', () => {
    const events = introSoundEvents();
    const at = (name: string) =>
      events.filter((event) => event.name === name).map((event) => Number(event.at.toFixed(2)));
    expect(at('turn')).toEqual([1.19, 2.91, 4.63, 6.35]);
    expect(at('tick')).toEqual([1.32, 3.04, 4.76]);
    expect(at('resolve')).toEqual([6.76]);
    expect(events[0]).toEqual({ name: 'bed', at: 0, volume: 0.35 });
    expect(INTRO_TIMELINE.total).toBeCloseTo(7.76, 5);
    expect(introClockSpeed(true) * 4).toBeCloseTo(INTRO_TIMELINE.total, 5);
  });

  it('holds a caption at rest and turns on the X axis', () => {
    const rest = introFrame(1.8, false);
    expect(rest.restText.toUpperCase()).toContain('BRAIN');
    expect(rest.restOpacity).toBe(1);
    expect(rest.sceneVisible).toBe(false);
    const turning = introFrame(2.83, false);
    expect(turning.sceneVisible).toBe(true);
    expect(turning.cubeAngle).toBeGreaterThan(90);
    expect(turning.cubeAngle).toBeLessThan(180);
    const reduced = introFrame(1.8, true);
    expect(reduced.sceneVisible).toBe(false);
    expect(reduced.artTransform).toContain('scale(1)');
  });

  it('does not drive a fuse hairline on desktop, mobile timing, or reduced motion', () => {
    for (const t of [0, 1.2, 1.8, 2.83, 3.2, 6.5]) {
      expect(introFrame(t, false)).not.toHaveProperty('fuseOpacity');
      expect(introFrame(t, false)).not.toHaveProperty('fuseScale');
      expect(introFrame(t, true)).not.toHaveProperty('fuseOpacity');
    }
  });

  it('skips on Esc, Enter, and Space, and has no em dashes', () => {
    expect(isIntroSkipKey('Escape')).toBe(true);
    expect(isIntroSkipKey('Enter')).toBe(true);
    expect(isIntroSkipKey(' ')).toBe(true);
    expect(isIntroSkipKey('a')).toBe(false);
    expect(parseIntroFreeze('3.2')).toBe(3.2);
    expect(parseIntroFreeze(null)).toBeNull();
    const copy = [...INTRO_LINES, INTRO_SKIP_HINT, PLAY_INTRO_LABEL, INTRO_SOUND_LABEL].join(' ');
    expect(copy).not.toMatch(/[—–]/);
    expect(INTRO_MIN_CAPTION_PX).toBeGreaterThanOrEqual(24);
    expect(INTRO_HINT_COLOR).toBe('#a1a1a6');
    expect(introNarrow(375)).toBe(true);
    expect(introNarrow(1280)).toBe(false);
    expect(introArtZoom(375)).toBeGreaterThan(1);
    expect(introArtZoom(1280)).toBe(1);
  });
});
