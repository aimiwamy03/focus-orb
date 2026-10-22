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
} from './palette';

describe('palette tokens meet WCAG AA on the orb background', () => {
  const tokens = [
    ['text', ORB_TEXT, 12],
    ['textDim', ORB_TEXT_DIM, 12],
    ['textQuiet', ORB_TEXT_QUIET, 12],
    ['placeholder', ORB_PLACEHOLDER, 15],
  ] as const;

  it.each(tokens)('%s is at least 4.5:1 on the orb bg', (_name, color, fontPx) => {
    expect(contrastRatio(color, ORB_BG)).toBeGreaterThanOrEqual(4.5);
    expect(meetsAaContrast(color, ORB_BG, fontPx)).toBe(true);
  });

  it('keeps the same floor on the settings sheet', () => {
    expect(meetsAaContrast(ORB_TEXT, SETTINGS_BG, 16)).toBe(true);
    expect(meetsAaContrast(ORB_TEXT_DIM, SETTINGS_BG, 12)).toBe(true);
    expect(meetsAaContrast(ORB_TEXT_QUIET, SETTINGS_BG, 12)).toBe(true);
  });

  it('exports the tokens the UI uses', () => {
    expect(PALETTE_TOKENS.bg).toBe(ORB_BG);
    expect(PALETTE_TOKENS.text).toBe(ORB_TEXT);
    expect(PALETTE_TOKENS.textDim).toBe(ORB_TEXT_DIM);
    expect(PALETTE_TOKENS.textQuiet).toBe(ORB_TEXT_QUIET);
    expect(PALETTE_TOKENS.placeholder).toBe(ORB_PLACEHOLDER);
  });
});
