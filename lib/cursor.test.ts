import { describe, expect, it } from 'vitest';
import {
  CURSOR_HIDE_MS,
  isKeepCursorTarget,
  promptShowsCursor,
  shouldHideCursor,
} from './cursor';

describe('shouldHideCursor', () => {
  it('never hides on a prompt, confirm, or button row', () => {
    for (const surface of [
      'ask',
      'stop-confirm',
      'session-confirm',
      'completed',
      'break',
      'meeting-soon',
    ] as const) {
      expect(
        shouldHideCursor({
          surface,
          stillMs: 10_000,
          overInteractive: false,
        })
      ).toBe(false);
    }
  });

  it('only hides during an active focus block after about 3s still', () => {
    expect(
      shouldHideCursor({
        surface: 'focusing',
        stillMs: CURSOR_HIDE_MS - 1,
        overInteractive: false,
      })
    ).toBe(false);
    expect(
      shouldHideCursor({
        surface: 'focusing',
        stillMs: CURSOR_HIDE_MS,
        overInteractive: false,
      })
    ).toBe(true);
    expect(
      shouldHideCursor({
        surface: 'in-meeting',
        stillMs: 10_000,
        overInteractive: false,
      })
    ).toBe(false);
  });

  it('restores immediately when the pointer is moving or over UI', () => {
    expect(
      shouldHideCursor({
        surface: 'focusing',
        stillMs: 0,
        overInteractive: false,
      })
    ).toBe(false);
    expect(
      shouldHideCursor({
        surface: 'focusing',
        stillMs: 10_000,
        overInteractive: true,
      })
    ).toBe(false);
    expect(
      shouldHideCursor({
        surface: 'focusing',
        stillMs: 10_000,
        overInteractive: false,
        settingsOpen: true,
      })
    ).toBe(false);
    expect(
      shouldHideCursor({
        surface: 'focusing',
        stillMs: 10_000,
        overInteractive: false,
        logOpen: true,
      })
    ).toBe(false);
  });

  it('keeps the cursor on first open and the mini-only fallback', () => {
    expect(
      shouldHideCursor({
        surface: 'focusing',
        stillMs: 10_000,
        overInteractive: false,
        firstOpen: true,
      })
    ).toBe(false);
    expect(
      shouldHideCursor({
        surface: 'focusing',
        stillMs: 10_000,
        overInteractive: false,
        miniOnly: true,
      })
    ).toBe(false);
  });
});

describe('promptShowsCursor', () => {
  it('treats break and session confirm as prompts', () => {
    expect(promptShowsCursor('break')).toBe(true);
    expect(promptShowsCursor('session-confirm')).toBe(true);
    expect(promptShowsCursor('focusing')).toBe(false);
  });
});

describe('isKeepCursorTarget', () => {
  it('keeps the cursor over the agenda and controls', () => {
    const agenda = document.createElement('aside');
    agenda.setAttribute('data-testid', 'agenda');
    const label = document.createElement('span');
    agenda.append(label);
    document.body.append(agenda);
    expect(isKeepCursorTarget(label)).toBe(true);

    const button = document.createElement('button');
    document.body.append(button);
    expect(isKeepCursorTarget(button)).toBe(true);
    expect(isKeepCursorTarget(document.body)).toBe(false);
    agenda.remove();
    button.remove();
  });
});
