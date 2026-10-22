import { describe, it, expect } from 'vitest';
import {
  contentFits,
  firstOverlappingPair,
  fullyInsideViewport,
  maxDrawnExtent,
  MIN_FIT_HEIGHT,
  MIN_PRESENCE_RADIUS,
  ORB_TEXT_GAP,
  orbDiskRect,
  orbLayout,
  type OrbCloudState,
  rectsOverlap,
  stackInsets,
} from './layout';

describe('rectsOverlap', () => {
  it('detects crossing rectangles and ignores separated ones', () => {
    const chips = { left: 400, top: 520, right: 880, bottom: 552 };
    const timeline = { left: 320, top: 540, right: 960, bottom: 580 };
    const start = { left: 600, top: 560, right: 680, bottom: 584 };
    expect(rectsOverlap(chips, timeline)).toBe(true);
    expect(rectsOverlap(chips, { ...timeline, top: 548, bottom: 580 })).toBe(true);
    expect(
      rectsOverlap(chips, { left: 320, top: 560, right: 960, bottom: 592 })
    ).toBe(false);
    expect(firstOverlappingPair([chips, start, timeline])).toEqual([0, 2]);
    expect(
      firstOverlappingPair([
        chips,
        { left: 320, top: 560, right: 960, bottom: 592 },
      ])
    ).toBeNull();
  });
});

describe('orbLayout fits the bottom stack', () => {
  const stackAsk = 280;

  it.each([
    [1280, 640],
    [1280, 800],
    [1440, 900],
    [1024, 768],
    [1280, MIN_FIT_HEIGHT],
  ])('keeps the orb above a %i x %i ask stack', (width, height) => {
    const layout = orbLayout(width, height, stackAsk);
    expect(contentFits(height, layout, stackAsk)).toBe(true);
    expect(layout.centerY + maxDrawnExtent(layout.radius, 'focusing')).toBeLessThanOrEqual(
      height - stackAsk - ORB_TEXT_GAP + 0.5
    );
    expect(layout.radius).toBeGreaterThanOrEqual(52);
  });

  it('shrinks the orb to fit Amy\'s 686x386 window', () => {
    const stack = 240;
    const layout = orbLayout(686, 386, stack);
    expect(contentFits(386, layout, stack)).toBe(true);
    expect(layout.centerY + maxDrawnExtent(layout.radius, 'free')).toBeLessThanOrEqual(
      386 - stack - ORB_TEXT_GAP + 0.5
    );
    expect(layout.radius).toBeGreaterThanOrEqual(MIN_PRESENCE_RADIUS);
    expect(layout.radius).toBeLessThan(orbLayout(1280, 800, stackAsk).radius);
  });

  it.each([
    [686, 386, 240],
    [1024, 768, 280],
    [1280, 640, 280],
  ])('keeps a full round disk on a %i x %i canvas above the stack', (width, height, stack) => {
    const layout = orbLayout(width, height, stack);
    const disk = orbDiskRect(layout);
    const { topPad } = stackInsets(height);
    expect(fullyInsideViewport(disk, width, height)).toBe(true);
    expect(disk.top).toBeGreaterThanOrEqual(topPad - 0.5);
    expect(layout.centerY + maxDrawnExtent(layout.radius)).toBeLessThanOrEqual(
      height - stack - ORB_TEXT_GAP + 0.5
    );
    expect(disk.right - disk.left).toBeCloseTo(2 * layout.radius, 5);
    expect(disk.bottom - disk.top).toBeCloseTo(2 * layout.radius, 5);
  });

  it('treats a vertical stack as non overlapping', () => {
    const prompt = { left: 430, top: 400, right: 850, bottom: 488 };
    const chips = { left: 400, top: 500, right: 880, bottom: 528 };
    const start = { left: 610, top: 536, right: 670, bottom: 556 };
    const timeline = { left: 320, top: 568, right: 960, bottom: 600 };
    expect(firstOverlappingPair([prompt, chips, start, timeline])).toBeNull();
    expect(fullyInsideViewport(start, 1280, 640)).toBe(true);
    expect(fullyInsideViewport({ ...start, bottom: 652 }, 1280, 640)).toBe(false);
  });

  it('shrinks on a short laptop versus the 800px desktop radius', () => {
    const tall = orbLayout(1280, 800, stackAsk);
    const short = orbLayout(1280, 640, stackAsk);
    expect(short.radius).toBeLessThanOrEqual(tall.radius);
    expect(short.centerY).toBeLessThan(tall.centerY + 40);
  });

  it.each([
    [1024, 920],
    [900, 1200],
  ])('keeps a square or tall %i x %i orb inside the available band', (width, height) => {
    const layout = orbLayout(width, height, stackAsk);
    expect(contentFits(height, layout, stackAsk)).toBe(true);
    expect(layout.centerX).toBeCloseTo(width / 2);
    expect(layout.centerY + maxDrawnExtent(layout.radius, 'focusing')).toBeLessThanOrEqual(
      height - stackAsk - ORB_TEXT_GAP + 0.5
    );
    expect(layout.centerY - layout.radius).toBeGreaterThanOrEqual(0);
    expect(layout.radius).toBeGreaterThanOrEqual(52);
  });

  it('recomputes after a 1280x640 window is resized to 1024x920', () => {
    const before = orbLayout(1280, 640, stackAsk);
    const after = orbLayout(1024, 920, stackAsk);
    expect(contentFits(920, after, stackAsk)).toBe(true);
    expect(after.centerX).toBeCloseTo(512);
    expect(after.centerX).not.toBeCloseTo(before.centerX);
    expect(after.centerY + maxDrawnExtent(after.radius)).toBeLessThanOrEqual(
      920 - stackAsk - ORB_TEXT_GAP + 0.5
    );
  });

  it.each<[number, number, OrbCloudState, number]>([
    [686, 386, 'free', 240],
    [686, 386, 'focusing', 96],
    [686, 386, 'meeting-soon', 130],
    [1024, 768, 'free', 280],
    [1024, 768, 'focusing', 110],
    [1024, 768, 'meeting-soon', 140],
    [1280, 640, 'free', 280],
    [1280, 640, 'focusing', 110],
    [1280, 640, 'meeting-soon', 140],
    [1440, 900, 'free', 280],
    [1440, 900, 'focusing', 110],
    [1440, 900, 'meeting-soon', 140],
  ])(
    'keeps the drawn cloud 12px above the status line at %i x %i (%s)',
    (width, height, state, stack) => {
      const layout = orbLayout(width, height, stack);
      const statusTop = height - stack;
      const extent = maxDrawnExtent(layout.radius, state);
      expect(layout.centerY + extent).toBeLessThanOrEqual(statusTop - ORB_TEXT_GAP + 0.5);
      expect(contentFits(height, layout, stack, state)).toBe(true);
    }
  );
});
