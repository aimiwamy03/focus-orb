import { describe, it, expect } from 'vitest';
import {
  contrastRatio,
  meetsAaContrast,
  ORB_BG,
  ORB_PLACEHOLDER,
  ORB_TEXT,
  ORB_TEXT_DIM,
  ORB_TEXT_QUIET,
  PALETTE_TOKENS,
  SETTINGS_BG,
  SETTINGS_MUTED,
  SETTINGS_TEXT,
  AGENDA_ACCENT,
  HIGHLIGHT_FILL,
  HIGHLIGHT_RING,
} from './palette';

describe('palette tokens meet WCAG AA on the orb background', () => {
  const tokens = [
    ['text', ORB_TEXT, 12],
    ['textDim (recent tasks)', ORB_TEXT_DIM, 15],
    ['textQuiet', ORB_TEXT_QUIET, 12],
    ['placeholder', ORB_PLACEHOLDER, 15],
  ] as const;

  it.each(tokens)('%s is at least 4.5:1 on the orb bg', (_name, color, fontPx) => {
    expect(contrastRatio(color, ORB_BG)).toBeGreaterThanOrEqual(4.5);
    expect(meetsAaContrast(color, ORB_BG, fontPx)).toBe(true);
  });

  it('keeps the agenda accent readable', () => {
    expect(meetsAaContrast(AGENDA_ACCENT, ORB_BG, 14)).toBe(true);
  });

  it('keeps the same floor on the settings sheet', () => {
    expect(meetsAaContrast(SETTINGS_TEXT, SETTINGS_BG, 16)).toBe(true);
    expect(meetsAaContrast(SETTINGS_MUTED, SETTINGS_BG, 14)).toBe(true);
  });

  it('exports the tokens the UI uses', () => {
    expect(PALETTE_TOKENS.bg).toBe(ORB_BG);
    expect(PALETTE_TOKENS.textDim).toBe(ORB_TEXT_DIM);
    expect(PALETTE_TOKENS.highlightFill).toBe(HIGHLIGHT_FILL);
  });

  it('keeps the WHOOP quiet line readable at 17px', () => {
    expect(meetsAaContrast(ORB_TEXT_QUIET, ORB_BG, 17)).toBe(true);
    expect(contrastRatio(ORB_TEXT_QUIET, ORB_BG)).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps highlighted text AA on the highlight fill', () => {
    expect(meetsAaContrast(ORB_TEXT, HIGHLIGHT_FILL, 15)).toBe(true);
    expect(contrastRatio(HIGHLIGHT_RING, ORB_BG)).toBeGreaterThanOrEqual(4.5);
  });
});
