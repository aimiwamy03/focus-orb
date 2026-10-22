import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { Hints } from './Hints';
import { SHORTCUTS_LABEL } from '@/lib/shortcuts';

afterEach(() => cleanup());

describe('Hints help toggle', () => {
  it('has no native tooltip and shares the keycap column width', () => {
    render(<Hints active chromeVisible />);
    const toggle = screen.getByTestId('help-toggle');
    expect(toggle.getAttribute('title')).toBeNull();
    expect(toggle.getAttribute('aria-label')).toBe(SHORTCUTS_LABEL);
    expect(toggle.className).toMatch(/help-toggle/);
    expect(toggle.className).not.toMatch(/px-3/);
    expect(toggle.className).not.toMatch(/rounded-full/);
  });
});
