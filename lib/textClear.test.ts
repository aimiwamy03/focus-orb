import { describe, it, expect } from 'vitest';
import { TEXT_CLEAR_FALLOFF, TEXT_CLEAR_PAD, textClearAlpha } from './textClear';

const rect = { left: 100, top: 100, right: 200, bottom: 120 };

describe('textClearAlpha', () => {
  it('is 0 inside the padded text rect', () => {
    expect(textClearAlpha(150, 110, [rect])).toBe(0);
    expect(textClearAlpha(100 - TEXT_CLEAR_PAD, 110, [rect])).toBe(0);
    expect(textClearAlpha(200 + TEXT_CLEAR_PAD, 110, [rect])).toBe(0);
  });

  it('is 1 well outside the falloff', () => {
    expect(textClearAlpha(400, 400, [rect])).toBe(1);
    expect(
      textClearAlpha(200 + TEXT_CLEAR_PAD + TEXT_CLEAR_FALLOFF + 1, 110, [rect])
    ).toBe(1);
  });

  it('fades smoothly across the 16px edge', () => {
    const mid = textClearAlpha(200 + TEXT_CLEAR_PAD + TEXT_CLEAR_FALLOFF / 2, 110, [rect]);
    expect(mid).toBeGreaterThan(0.4);
    expect(mid).toBeLessThan(0.6);
    expect(textClearAlpha(200 + TEXT_CLEAR_PAD + 2, 110, [rect])).toBeLessThan(mid);
  });
});
