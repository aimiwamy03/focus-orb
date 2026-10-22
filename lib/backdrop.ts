import { contrastRatio, ORB_TEXT } from './palette';

export const SHOW_BACKDROP_KEY = 'focusOrb:showBackdrop';
export const SHOW_BACKDROP_LABEL = 'Backdrop';
export const BACKDROP_WEBP = '/backdrop.webp';
export const BACKDROP_AVIF = '/backdrop.avif';
export const BACKDROP_WIDTH = 2736;
export const BACKDROP_HEIGHT = 1536;
/** Shipping brightness: image at 50% over black, plus a 12% black wash. */
export const BACKDROP_BRIGHTNESS = 0.5;
export const BACKDROP_WASH = 0.12;
/**
 * Sampled from option-C.png at the image center (23, 25, 35).
 * Heading and status sit in this black field.
 */
export const BACKDROP_CENTER_SRC = '#171923';
export const ASK_STATUS = '#8a8a90';
export const HEADING_CONTRAST_MIN = 15;
export const STATUS_CONTRAST_MIN = 6;

export const ICON_HREFS = {
  svg: '/favicon.svg',
  png32: '/favicon-32.png',
  ico: '/favicon.ico',
  apple: '/apple-touch-icon.png',
  icon192: '/icon-192.png',
  icon512: '/icon-512.png',
} as const;

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const raw = hex.replace('#', '');
  const full = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw;
  const n = Number.parseInt(full, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgbToHex(r: number, g: number, b: number): string {
  const to = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}

/** Composite `hex` at `brightness` over black. */
export function dimOnBlack(hex: string, brightness: number): string {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHex(r * brightness, g * brightness, b * brightness);
}

export function backdropCenterHex(
  brightness: number = BACKDROP_BRIGHTNESS,
  wash: number = BACKDROP_WASH
): string {
  return dimOnBlack(BACKDROP_CENTER_SRC, brightness * (1 - wash));
}

export function backdropHeadingContrast(
  brightness: number = BACKDROP_BRIGHTNESS
): number {
  return contrastRatio(ORB_TEXT, backdropCenterHex(brightness));
}

export function backdropStatusContrast(
  brightness: number = BACKDROP_BRIGHTNESS
): number {
  return contrastRatio(ASK_STATUS, backdropCenterHex(brightness));
}

export function loadShowBackdrop(): boolean {
  if (typeof localStorage === 'undefined') return true;
  return localStorage.getItem(SHOW_BACKDROP_KEY) !== '0';
}

export function saveShowBackdrop(value: boolean): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(SHOW_BACKDROP_KEY, value ? '1' : '0');
}
