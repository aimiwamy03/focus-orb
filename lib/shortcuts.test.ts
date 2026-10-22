import { describe, it, expect, beforeEach } from 'vitest';
import {
  ENTER_HINT,
  GOT_IT_LABEL,
  isShortcutKey,
  loadShortcutsCardSeen,
  saveShortcutsCardSeen,
  SHORTCUT_ROWS,
  SHORTCUTS_CARD_KEY,
  SHORTCUTS_LABEL,
  shouldShowShortcutsCard,
  SPACE_HINT,
} from './shortcuts';

describe('shouldShowShortcutsCard', () => {
  it('shows once after calendar or sample day, then never again', () => {
    expect(
      shouldShowShortcutsCard({ firstOpen: true, miniOnly: false, seen: false, surface: 'ask' })
    ).toBe(false);
    expect(
      shouldShowShortcutsCard({ firstOpen: false, miniOnly: false, seen: false, surface: 'ask' })
    ).toBe(true);
    expect(
      shouldShowShortcutsCard({ firstOpen: false, miniOnly: false, seen: true, surface: 'ask' })
    ).toBe(false);
    expect(
      shouldShowShortcutsCard({ firstOpen: false, miniOnly: true, seen: false, surface: 'ask' })
    ).toBe(false);
    expect(
      shouldShowShortcutsCard({
        firstOpen: false,
        miniOnly: false,
        seen: false,
        surface: 'focusing',
      })
    ).toBe(false);
    expect(
      shouldShowShortcutsCard({
        firstOpen: false,
        miniOnly: false,
        seen: false,
        surface: 'meeting-soon',
      })
    ).toBe(false);
  });
});

describe('isShortcutKey', () => {
  it('matches the four listed shortcuts', () => {
    expect(isShortcutKey('f')).toBe(true);
    expect(isShortcutKey('s')).toBe(true);
    expect(isShortcutKey(' ')).toBe(true);
    expect(isShortcutKey('p')).toBe(true);
    expect(isShortcutKey('?')).toBe(false);
    expect(isShortcutKey('Enter')).toBe(false);
  });
});

describe('shortcuts storage and copy', () => {
  beforeEach(() => {
    localStorage.removeItem(SHORTCUTS_CARD_KEY);
  });

  it('round-trips the seen flag', () => {
    expect(loadShortcutsCardSeen()).toBe(false);
    saveShortcutsCardSeen();
    expect(loadShortcutsCardSeen()).toBe(true);
  });

  it('lists four shortcuts and has no em dashes', () => {
    expect(SHORTCUT_ROWS).toHaveLength(4);
    expect(SHORTCUT_ROWS.map((row) => row.key)).toEqual(['F', 'S', 'Space', 'P']);
    const copy = [
      SHORTCUTS_LABEL,
      GOT_IT_LABEL,
      ENTER_HINT,
      SPACE_HINT,
      ...SHORTCUT_ROWS.map((row) => `${row.key} ${row.action}`),
    ].join(' ');
    expect(copy).not.toMatch(/[—–]/);
  });
});
