import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { isSquareKeycap, KeyHint } from './KeyHint';

afterEach(() => cleanup());

describe('KeyHint', () => {
  it('marks single-letter caps as squares and Space as wide', () => {
    expect(isSquareKeycap('F')).toBe(true);
    expect(isSquareKeycap('S')).toBe(true);
    expect(isSquareKeycap('P')).toBe(true);
    expect(isSquareKeycap('L')).toBe(true);
    expect(isSquareKeycap('V')).toBe(true);
    expect(isSquareKeycap('Space')).toBe(false);
    expect(isSquareKeycap('Enter')).toBe(false);

    for (const letter of ['F', 'S', 'P', 'L', 'V']) {
      cleanup();
      render(<KeyHint label={letter} />);
      const cap = screen.getByTestId(`keycap-${letter}`);
      expect(cap.getAttribute('data-keycap')).toBe('square');
      expect(cap.className).toMatch(/keycap-square/);
      expect(cap.className).not.toMatch(/px-1/);
    }

    cleanup();
    render(<KeyHint label="Space" />);
    const space = screen.getByTestId('keycap-Space');
    expect(space.getAttribute('data-keycap')).toBe('wide');
    expect(space.className).toMatch(/keycap-wide/);
  });
});
