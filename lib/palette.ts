export const ORB_BG = '#161616';
export const ORB_TEXT = '#e8e8e8';
export const ORB_TEXT_DIM = '#d0d0d0';
export const ORB_TEXT_QUIET = '#b4b4b4';
export const ORB_PLACEHOLDER = '#a3a3a3';
export const SETTINGS_BG = '#18181b';
export const SETTINGS_TEXT = '#e4e4e7';
export const SETTINGS_MUTED = '#a1a1aa';
export const AGENDA_ACCENT = '#8eb4c8';

const AA_NORMAL = 4.5;
const AA_LARGE = 3;

export const PALETTE_TOKENS = {
  bg: ORB_BG,
  text: ORB_TEXT,
  textDim: ORB_TEXT_DIM,
  textQuiet: ORB_TEXT_QUIET,
  placeholder: ORB_PLACEHOLDER,
  settingsBg: SETTINGS_BG,
  settingsText: SETTINGS_TEXT,
  settingsMuted: SETTINGS_MUTED,
  agendaAccent: AGENDA_ACCENT,
} as const;

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const raw = hex.replace('#', '');
  const full = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw;
  const n = Number.parseInt(full, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function channel(value: number): number {
  const s = value / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(foreground: string, background: string): number {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}

export function meetsAaContrast(
  foreground: string,
  background: string,
  fontPx = 12
): boolean {
  const ratio = contrastRatio(foreground, background);
  return fontPx >= 18 ? ratio >= AA_LARGE : ratio >= AA_NORMAL;
}
