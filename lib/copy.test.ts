import { describe, it, expect } from 'vitest';
import {
  ANOTHER_ROUND_LABEL,
  ASK_PROMPT,
  DONE_LABEL,
  END_EARLY_PROMPT,
  END_LABEL,
  formatCompleted,
  KEEP_GOING_LABEL,
  START_LABEL,
} from './focusPrompt';
import {
  ENTER_HINT,
  FULLSCREEN_LABEL,
  GOT_IT_LABEL,
  SHORTCUT_ROWS,
  SHORTCUTS_LABEL,
  SPACE_HINT,
} from './shortcuts';
import {
  CHROME_HINT,
  DEFAULT_DURATION_LABEL,
  FLOATING_RESTORE_LABEL,
  LEAVE_TAB_HINT,
  MINI_ONLY_LABEL,
  POP_OUT_LABEL,
  SIGN_OUT_LABEL,
  WARN_BEFORE_MEETINGS_LABEL,
} from './miniOrb';
import { CONNECT_LABEL, SAMPLE_DAY_LINK, WELCOME_LINE } from './onboarding';
import { SAMPLE_DAY_LABEL } from './fixtures';
import { formatClockRange } from './day';

const COPY = [
  ASK_PROMPT,
  END_EARLY_PROMPT,
  KEEP_GOING_LABEL,
  END_LABEL,
  START_LABEL,
  ANOTHER_ROUND_LABEL,
  DONE_LABEL,
  formatCompleted(18, 'Write the spec', 50),
  ENTER_HINT,
  SPACE_HINT,
  FULLSCREEN_LABEL,
  GOT_IT_LABEL,
  SHORTCUTS_LABEL,
  ...SHORTCUT_ROWS.map((row) => `${row.key} ${row.action}`),
  CHROME_HINT,
  LEAVE_TAB_HINT,
  FLOATING_RESTORE_LABEL,
  MINI_ONLY_LABEL,
  POP_OUT_LABEL,
  DEFAULT_DURATION_LABEL,
  SIGN_OUT_LABEL,
  WARN_BEFORE_MEETINGS_LABEL,
  CONNECT_LABEL,
  SAMPLE_DAY_LINK,
  WELCOME_LINE,
  SAMPLE_DAY_LABEL,
];

describe('user-facing copy', () => {
  it('has no em or en dashes and names fullscreen in full', () => {
    for (const line of COPY) {
      expect(line).not.toMatch(/[—–]/);
    }
    expect(FULLSCREEN_LABEL).toBe('Fullscreen');
    expect(FLOATING_RESTORE_LABEL).toBe('Open floating orb');
    expect(WARN_BEFORE_MEETINGS_LABEL).toBe('Warn me before meetings');
  });

  it('writes clock ranges with a hyphen', () => {
    const start = new Date(2026, 9, 9, 14, 0);
    const end = new Date(2026, 9, 9, 15, 0);
    expect(formatClockRange(start, end)).toBe('2:00-3:00');
    expect(formatClockRange(start, end)).not.toMatch(/[—–]/);
  });
});
