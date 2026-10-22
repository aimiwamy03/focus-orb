export const SHORTCUTS_CARD_KEY = 'focusOrb:shortcutsCard';
export const SHORTCUTS_CARD_MS = 8000;
export const SHORTCUTS_LABEL = 'Shortcuts';
export const GOT_IT_LABEL = 'Got it';
export const ENTER_HINT = 'Enter to start';
export const SPACE_HINT = 'Space to pause';
export const FULLSCREEN_LABEL = 'Fullscreen';

export const SHORTCUT_ROWS = [
  { id: 'fullscreen', key: 'F', action: 'fullscreen', testId: 'fullscreen-toggle' },
  { id: 'settings', key: 'S', action: 'settings', testId: 'settings-gear' },
  { id: 'focus', key: 'Space', action: 'start/stop focus', testId: 'chrome-focus' },
  { id: 'voice', key: 'V', action: 'Voice', testId: 'chrome-voice' },
  { id: 'pop-out', key: 'P', action: 'pop out', testId: 'pop-out' },
  { id: 'mini-only', key: 'M', action: 'mini only', testId: 'mini-only' },
  { id: 'log', key: 'L', action: 'log', testId: 'focus-log-open' },
] as const;

export type ShortcutId = (typeof SHORTCUT_ROWS)[number]['id'];

export function isShortcutKey(key: string): boolean {
  return (
    key === 'f' ||
    key === 'F' ||
    key === 's' ||
    key === 'S' ||
    key === ' ' ||
    key === 'v' ||
    key === 'V' ||
    key === 'p' ||
    key === 'P' ||
    key === 'm' ||
    key === 'M' ||
    key === 'l' ||
    key === 'L'
  );
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
  surface?: string | null;
}): boolean {
  return (
    !input.firstOpen &&
    !input.miniOnly &&
    !input.seen &&
    input.surface === 'ask'
  );
}
