import { describe, it, expect } from 'vitest';
import { clampCss, fluidPx, TYPE_SCALE } from './typeScale';

describe('fluid type scale at the 1280px baseline', () => {
  const w = 1280;

  it('hits the Ask sizes Amy asked for', () => {
    expect(fluidPx(TYPE_SCALE.heading, w)).toBeGreaterThanOrEqual(28);
    expect(fluidPx(TYPE_SCALE.heading, w)).toBeLessThanOrEqual(32);
    expect(fluidPx(TYPE_SCALE.input, w)).toBeCloseTo(24, 0);
    expect(fluidPx(TYPE_SCALE.status, w)).toBeCloseTo(18, 0);
    expect(fluidPx(TYPE_SCALE.chip, w)).toBeGreaterThanOrEqual(17);
    expect(fluidPx(TYPE_SCALE.chip, w)).toBeLessThanOrEqual(18);
    expect(fluidPx(TYPE_SCALE.button, w)).toBeCloseTo(18, 0);
    expect(fluidPx(TYPE_SCALE.hint, w)).toBeGreaterThanOrEqual(14);
    expect(fluidPx(TYPE_SCALE.chrome, w)).toBeGreaterThanOrEqual(15);
    expect(fluidPx(TYPE_SCALE.key, w)).toBeGreaterThanOrEqual(14);
  });

  it('stays readable at Amy\'s 686px window', () => {
    expect(fluidPx(TYPE_SCALE.heading, 686)).toBeGreaterThanOrEqual(22);
    expect(fluidPx(TYPE_SCALE.input, 686)).toBeGreaterThanOrEqual(18);
    expect(fluidPx(TYPE_SCALE.status, 686)).toBeGreaterThanOrEqual(15);
    expect(fluidPx(TYPE_SCALE.chip, 686)).toBeGreaterThanOrEqual(15);
    expect(fluidPx(TYPE_SCALE.hint, 686)).toBeGreaterThanOrEqual(14);
    expect(fluidPx(TYPE_SCALE.chrome, 686)).toBeGreaterThanOrEqual(15);
  });

  it('emits clamp() strings the CSS theme uses', () => {
    expect(clampCss(TYPE_SCALE.heading)).toBe('clamp(22px, 1.4vw + 12px, 30px)');
    expect(clampCss(TYPE_SCALE.input)).toBe('clamp(18px, 1.1vw + 10px, 24px)');
  });
});
