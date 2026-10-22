import { describe, it, expect } from 'vitest';
import {
  TEXT_CLEAR_FALLOFF,
  TEXT_CLEAR_PAD,
  collectTextClearRects,
  isVisibleClearTarget,
  textClearAlpha,
} from './textClear';

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

describe('hidden chrome does not punch the orb', () => {
  it('skips visibility hidden, display none, and opacity 0 targets', () => {
    const hidden = document.createElement('span');
    hidden.style.visibility = 'hidden';
    document.body.append(hidden);
    const gone = document.createElement('span');
    gone.style.display = 'none';
    document.body.append(gone);
    const faded = document.createElement('span');
    faded.style.opacity = '0';
    document.body.append(faded);
    const shown = document.createElement('span');
    shown.style.visibility = 'visible';
    shown.style.opacity = '1';
    document.body.append(shown);
    expect(isVisibleClearTarget(hidden)).toBe(false);
    expect(isVisibleClearTarget(gone)).toBe(false);
    expect(isVisibleClearTarget(faded)).toBe(false);
    expect(isVisibleClearTarget(shown)).toBe(true);
    hidden.remove();
    gone.remove();
    faded.remove();
    shown.remove();
  });

  it('does not collect rects from hidden keycaps', () => {
    const cap = document.createElement('kbd');
    cap.setAttribute('data-text-clear', '');
    cap.style.visibility = 'hidden';
    cap.style.position = 'fixed';
    cap.style.left = '350px';
    cap.style.top = '23px';
    cap.style.width = '22px';
    cap.style.height = '20px';
    document.body.append(cap);
    expect(collectTextClearRects()).toEqual([]);
    cap.remove();
  });
});
