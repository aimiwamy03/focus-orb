import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Hints } from './Hints';
import { SHORTCUT_ROWS, SHORTCUTS_LABEL } from '@/lib/shortcuts';

afterEach(() => cleanup());

describe('Hints chrome menu', () => {
  it('has no native tooltip and sits over the top-right key column', () => {
    render(<Hints active chromeVisible />);
    const toggle = screen.getByTestId('help-toggle');
    expect(toggle.getAttribute('title')).toBeNull();
    expect(toggle.getAttribute('aria-label')).toBe(SHORTCUTS_LABEL);
    expect(toggle.className).toMatch(/help-toggle/);
    expect(toggle.className).toMatch(/right-4/);
    expect(toggle.className).not.toMatch(/left-4/);
    expect(toggle.className).not.toMatch(/px-3/);
    expect(toggle.className).not.toMatch(/rounded-full/);
  });

  it('opens clickable rows with keycaps and no pill highlight', () => {
    const onAction = vi.fn();
    render(<Hints active chromeVisible onAction={onAction} />);
    fireEvent.click(screen.getByTestId('help-toggle'));
    const menu = screen.getByTestId('short-help');
    expect(menu.className).toMatch(/right-4/);
    expect(menu.className).not.toMatch(/left-4/);
    for (const row of SHORTCUT_ROWS) {
      const item = screen.getByTestId(row.testId);
      expect(item.tagName).toBe('BUTTON');
      expect(item.className).not.toMatch(/rounded-full|ring-2|pill/);
      expect(item.textContent).toContain(row.action);
      expect(screen.getByTestId(`keycap-${row.key}`)).toBeTruthy();
    }
    fireEvent.click(screen.getByTestId('focus-log-open'));
    expect(onAction).toHaveBeenCalledWith('log');
    expect(screen.queryByTestId('short-help')).toBeNull();
  });
});
