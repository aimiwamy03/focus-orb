import type { PromptSurface } from './focusPrompt';

export const CURSOR_HIDE_MS = 3000;

const PROMPT_SURFACES: ReadonlySet<PromptSurface> = new Set([
  'ask',
  'stop-confirm',
  'session-confirm',
  'completed',
  'break',
  'meeting-soon',
]);

export const KEEP_CURSOR_SELECTOR = [
  'button',
  'a',
  'input',
  'textarea',
  'select',
  '[role="button"]',
  '[data-interactive]',
  '[data-testid="agenda"]',
  '[data-testid="focus-prompt"]',
  '[data-testid="settings-sheet"]',
  '[data-testid="focus-log"]',
].join(', ');

export function promptShowsCursor(surface: PromptSurface | null | undefined): boolean {
  return surface != null && PROMPT_SURFACES.has(surface);
}

export function isKeepCursorTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest(KEEP_CURSOR_SELECTOR));
}

export function shouldHideCursor(input: {
  surface: PromptSurface | null;
  stillMs: number;
  overInteractive: boolean;
  firstOpen?: boolean;
  miniOnly?: boolean;
  settingsOpen?: boolean;
  logOpen?: boolean;
}): boolean {
  if (input.firstOpen || input.miniOnly || input.settingsOpen || input.logOpen) return false;
  if (input.overInteractive) return false;
  if (promptShowsCursor(input.surface)) return false;
  if (input.surface !== 'focusing') return false;
  return input.stillMs >= CURSOR_HIDE_MS;
}
