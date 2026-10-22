import { describe, it, expect } from 'vitest';
import { ensureMiniCanvasSize, sizeMiniCanvas } from './drawMiniOrb';

describe('sizeMiniCanvas', () => {
  it('uses the window box and devicePixelRatio instead of a 180 square', () => {
    const canvas = document.createElement('canvas');
    Object.defineProperty(canvas, 'clientWidth', { configurable: true, value: 240 });
    Object.defineProperty(canvas, 'clientHeight', { configurable: true, value: 180 });
    Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 2 });
    expect(sizeMiniCanvas(canvas)).toBe(2);
    expect(canvas.width).toBe(480);
    expect(canvas.height).toBe(360);
    expect(canvas.style.width).toBe('100%');
    expect(canvas.style.height).toBe('100%');
  });

  it('accepts an explicit PiP innerWidth/innerHeight', () => {
    const canvas = document.createElement('canvas');
    sizeMiniCanvas(canvas, { width: 320, height: 240, dpr: 1 });
    expect(canvas.width).toBe(320);
    expect(canvas.height).toBe(240);
  });

  it('re-measures when the box changes', () => {
    const canvas = document.createElement('canvas');
    Object.defineProperty(canvas, 'clientWidth', { configurable: true, value: 180 });
    Object.defineProperty(canvas, 'clientHeight', { configurable: true, value: 180 });
    Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 1 });
    ensureMiniCanvasSize(canvas);
    expect(canvas.width).toBe(180);
    Object.defineProperty(canvas, 'clientWidth', { configurable: true, value: 240 });
    ensureMiniCanvasSize(canvas);
    expect(canvas.width).toBe(240);
    expect(canvas.height).toBe(180);
  });

  it('sizes a large 600x600 PiP from the CSS box', () => {
    const canvas = document.createElement('canvas');
    Object.defineProperty(canvas, 'clientWidth', { configurable: true, value: 600 });
    Object.defineProperty(canvas, 'clientHeight', { configurable: true, value: 566 });
    Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 2 });
    expect(sizeMiniCanvas(canvas)).toBe(2);
    expect(canvas.width).toBe(1200);
    expect(canvas.height).toBe(1132);
    expect(canvas.style.width).toBe('100%');
    expect(canvas.style.height).toBe('100%');
  });
});
