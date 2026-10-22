import { describe, it, expect } from 'vitest';
import { fullyInsideViewport, orbDiskRect, orbLayout } from './layout';
import {
  backingMatchesCss,
  drawnCenterCss,
  ensureOrbCanvasSize,
  sizeOrbCanvas,
} from './orbCanvas';

describe('sizeOrbCanvas', () => {
  it('sizes the backing store from the CSS box times dpr, not a leftover window', () => {
    const canvas = document.createElement('canvas');
    Object.defineProperty(canvas, 'clientWidth', { configurable: true, value: 1024 });
    Object.defineProperty(canvas, 'clientHeight', { configurable: true, value: 920 });
    Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 2 });
    const sized = sizeOrbCanvas(canvas);
    expect(sized).toEqual({ width: 1024, height: 920, dpr: 2 });
    expect(canvas.width).toBe(2048);
    expect(canvas.height).toBe(1840);
    expect(canvas.style.width).toBe('100%');
    expect(canvas.style.height).toBe('100%');
    expect(backingMatchesCss(canvas, sized)).toBe(true);
  });

  it('accepts an explicit 600x600 PiP box', () => {
    const canvas = document.createElement('canvas');
    const sized = sizeOrbCanvas(canvas, { width: 600, height: 600, dpr: 2 });
    expect(canvas.width).toBe(1200);
    expect(canvas.height).toBe(1200);
    expect(sized.dpr).toBe(2);
    expect(canvas.style.width).toBe('100%');
  });

  it('re-measures when the CSS box grows after a resize', () => {
    const canvas = document.createElement('canvas');
    Object.defineProperty(canvas, 'clientWidth', { configurable: true, value: 180 });
    Object.defineProperty(canvas, 'clientHeight', { configurable: true, value: 180 });
    Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 2 });
    ensureOrbCanvasSize(canvas);
    expect(canvas.width).toBe(360);
    Object.defineProperty(canvas, 'clientWidth', { configurable: true, value: 600 });
    Object.defineProperty(canvas, 'clientHeight', { configurable: true, value: 566 });
    const sized = ensureOrbCanvasSize(canvas);
    expect(canvas.width).toBe(1200);
    expect(canvas.height).toBe(1132);
    expect(backingMatchesCss(canvas, sized)).toBe(true);
  });
});

describe('orb disk vs canvas', () => {
  it.each([
    [686, 386, 240],
    [1024, 768, 280],
    [1280, 640, 280],
  ])('fits the full sphere in a %i x %i canvas', (width, height, stack) => {
    const layout = orbLayout(width, height, stack);
    const css = { width, height, dpr: 1 };
    const buffer = { width, height };
    const drawn = drawnCenterCss(layout, buffer, css, 1);
    const disk = orbDiskRect({ ...layout, centerX: drawn.x, centerY: drawn.y });
    expect(fullyInsideViewport(disk, width, height)).toBe(true);
    expect(layout.radius * 2).toBeLessThanOrEqual(Math.min(width, height));
  });
});

describe('drawnCenterCss', () => {
  const stackAsk = 236;

  it('keeps the drawn center on the layout center when buffer matches CSS * dpr', () => {
    const layout = orbLayout(1024, 920, stackAsk);
    const drawn = drawnCenterCss(
      layout,
      { width: 2048, height: 1840 },
      { width: 1024, height: 920 },
      2
    );
    expect(drawn.x).toBeCloseTo(layout.centerX);
    expect(drawn.y).toBeCloseTo(layout.centerY);
    expect(drawn.x / 1024).toBeCloseTo(0.5, 2);
  });

  it('shifts the orb toward 40% x when a 1280-wide buffer is shown at 1024', () => {
    const layout = orbLayout(1024, 920, stackAsk);
    const drawn = drawnCenterCss(
      layout,
      { width: 1280, height: 640 },
      { width: 1024, height: 920 },
      1
    );
    expect(drawn.x / 1024).toBeCloseTo(0.4, 1);
    expect(drawn.x).toBeLessThan(460);
  });
});
