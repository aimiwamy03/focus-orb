import { describe, it, expect } from 'vitest';
import { maxDrawnExtent, orbLayout } from './layout';
import {
  TEXT_CLEAR_FALLOFF,
  TEXT_CLEAR_PAD,
  collectTextClearRects,
  isVisibleClearTarget,
  rectOverlapsCircle,
  textClearAlpha,
  textClearRectsOnDisk,
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

describe('text-clear does not cut the disk', () => {
  function stackRects(viewW: number, viewH: number, stackH: number) {
    const stackTop = viewH - stackH;
    return [
      {
        left: viewW / 2 - 120,
        top: stackTop,
        right: viewW / 2 + 120,
        bottom: stackTop + 21,
      },
      {
        left: viewW / 2 - 170,
        top: stackTop + 28,
        right: viewW / 2 + 170,
        bottom: stackTop + 58,
      },
    ];
  }

  function sampleDisk(
    disk: { centerX: number; centerY: number; radius: number },
    step = 4
  ) {
    const points: [number, number][] = [];
    for (let y = disk.centerY - disk.radius; y <= disk.centerY + disk.radius; y += step) {
      for (let x = disk.centerX - disk.radius; x <= disk.centerX + disk.radius; x += step) {
        const dx = x - disk.centerX;
        const dy = y - disk.centerY;
        if (dx * dx + dy * dy <= disk.radius * disk.radius) points.push([x, y]);
      }
    }
    return points;
  }

  it('skips a status line that sits below the disk even when pad would reach it', () => {
    const disk = { centerX: 343, centerY: 92, radius: 48 };
    const status = { left: 223, top: 146, right: 463, bottom: 167 };
    expect(rectOverlapsCircle(status, disk.centerX, disk.centerY, disk.radius)).toBe(
      false
    );
    expect(textClearRectsOnDisk([status], disk)).toEqual([]);
    expect(textClearAlpha(disk.centerX, disk.centerY + disk.radius - 1, [status])).toBe(
      0
    );
    expect(
      textClearAlpha(disk.centerX, disk.centerY + disk.radius - 1, textClearRectsOnDisk([status], disk))
    ).toBe(1);
  });

  it('keeps a rect that actually crosses the disk', () => {
    const disk = { centerX: 343, centerY: 92, radius: 48 };
    const through = { left: 300, top: 80, right: 500, bottom: 110 };
    expect(textClearRectsOnDisk([through], disk)).toEqual([through]);
  });

  it.each([
    [686, 386, 240],
    [1024, 768, 280],
    [1280, 640, 280],
  ])(
    'draws every in-radius point at %i x %i with no rect subtraction',
    (width, height, stack) => {
      const layout = orbLayout(width, height, stack);
      const applied = textClearRectsOnDisk(
        stackRects(width, height, stack),
        {
          centerX: layout.centerX,
          centerY: layout.centerY,
          radius: maxDrawnExtent(layout.radius),
        }
      );
      expect(applied).toEqual([]);
      for (const [x, y] of sampleDisk(layout)) {
        expect(textClearAlpha(x, y, applied)).toBe(1);
      }
    }
  );
});
