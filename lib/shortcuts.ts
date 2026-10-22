export const SHORTCUTS_CARD_KEY = 'focusOrb:shortcutsCard';
export const SHORTCUTS_CARD_MS = 8000;
export const SHORTCUTS_LABEL = 'Shortcuts';
export const GOT_IT_LABEL = 'Got it';
export const ENTER_HINT = 'Enter to start';
export const SPACE_HINT = 'Space to pause';
export const FULLSCREEN_LABEL = 'Full';

export const SHORTCUT_ROWS = [
  { key: 'F', action: 'fullscreen' },
  { key: 'S', action: 'settings' },
  { key: 'Space', action: 'start/stop focus' },
  { key: 'P', action: 'pop out' },
] as const;

export function isShortcutKey(key: string): boolean {
  return key === 'f' || key === 'F' || key === 's' || key === 'S' || key === ' ' || key === 'p' || key === 'P';
}

export function loadShortcutsCardSeen(): boolean {
  if (typeof localStorage === 'undefined') return false;
  return localStorage.getItem(SHORTCUTS_CARD_KEY) === '1';
}

export function saveShortcutsCardSeen(): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(SHORTCUTS_CARD_KEY, '1');
}

export function shouldShowShortcutsCard(input: {
  firstOpen: boolean;
  miniOnly: boolean;
  seen: boolean;
}): boolean {
  return !input.firstOpen && !input.miniOnly && !input.seen;
}
