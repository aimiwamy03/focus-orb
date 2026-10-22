import { DayState, formatCompactDuration } from './day';

export type FaviconState = 'dense' | 'focusing' | 'scattered' | 'dim';

export { formatCompactDuration };

/** Browser tab and window title. Never a status string. */
export const APP_TITLE = 'Focus Orb';

export function faviconStateFor(input: {
  scatter: number;
  state: DayState;
  isManualFocus?: boolean;
}): FaviconState {
  if (input.state === 'in-meeting' || input.state === 'in-run') return 'dim';
  if (input.scatter >= 0.7) return 'dim';
  if (input.scatter >= 0.2) return 'scattered';
  if (input.isManualFocus) return 'focusing';
  return 'dense';
}

export const FAVICON_SIZE = 32;
export const FAVICON_SEED = 20261011;
export const LOGO_CORE = '#80C1E1';
export const LOGO_DOT = '#ECECEE';
export const LOGO_BG = '#000000';
export const LOGO_DOT_COUNT = 10;
/** Logo B geometry in the 1024 viewBox. */
export const LOGO_CORE_R = 128 / 1024;
export const LOGO_DOT_R = 38 / 1024;
export const LOGO_RING_R = 300 / 1024;

export function logoDotAngle(index: number): number {
  return -Math.PI / 2 + (index * 2 * Math.PI) / LOGO_DOT_COUNT;
}

export function logoLayout(
  size: number,
  scatter = 0
): {
  cx: number;
  cy: number;
  coreR: number;
  dotR: number;
  dots: Array<{ x: number; y: number }>;
} {
  const cx = size / 2;
  const cy = size / 2;
  const coreR = size * LOGO_CORE_R;
  const dotR = size * LOGO_DOT_R;
  const ring = size * LOGO_RING_R;
  const dots = Array.from({ length: LOGO_DOT_COUNT }, (_, i) => {
    const angle = logoDotAngle(i);
    const radialX = Math.cos(angle);
    const radialY = Math.sin(angle);
    const escape = scatter * ring * 0.55;
    const x = cx + radialX * (ring + escape) + (scatter > 0 ? 0.2 * escape * 0.7071 : 0);
    const y = cy + radialY * (ring + escape) + (scatter > 0 ? 0.2 * escape * 0.7071 : 0);
    return { x, y };
  });
  return { cx, cy, coreR, dotR, dots };
}

function fillCircle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  fill: string
): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
}

export function drawOrbFavicon(
  ctx: CanvasRenderingContext2D,
  state: FaviconState,
  _seed: number = FAVICON_SEED
): void {
  const size = ctx.canvas.width || FAVICON_SIZE;
  ctx.fillStyle = LOGO_BG;
  ctx.fillRect(0, 0, size, size);

  const scatter = state === 'scattered' ? 0.7 : state === 'dim' ? 0.2 : 0;
  const { cx, cy, coreR, dotR, dots } = logoLayout(size, scatter);
  const dim = state === 'dim' ? 0.38 : 1;
  const glow = state === 'focusing' ? 1 : 0;

  if (glow > 0) {
    const gradient = ctx.createRadialGradient(cx, cy, coreR * 0.2, cx, cy, coreR * 2.6);
    gradient.addColorStop(0, 'rgba(128, 193, 225, 0.7)');
    gradient.addColorStop(0.45, 'rgba(128, 193, 225, 0.28)');
    gradient.addColorStop(1, 'rgba(128, 193, 225, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
  }

  fillCircle(ctx, cx, cy, coreR * (glow ? 1.08 : 1), withAlpha(LOGO_CORE, dim));
  for (const dot of dots) {
    fillCircle(ctx, dot.x, dot.y, dotR, withAlpha(LOGO_DOT, dim));
  }
}

function withAlpha(hex: string, alpha: number): string {
  if (alpha >= 1) return hex;
  const n = Number.parseInt(hex.replace('#', ''), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

export function applyOrbFavicon(state: FaviconState): void {
  if (typeof document === 'undefined') return;
  const canvas = document.createElement('canvas');
  canvas.width = FAVICON_SIZE;
  canvas.height = FAVICON_SIZE;
  const ctx = canvas.getContext('2d');
  let href = state === 'dense' ? '/favicon-32.png' : '';
  if (ctx) {
    drawOrbFavicon(ctx, state);
    href = canvas.toDataURL('image/png');
  } else if (!href) {
    href = '/favicon-32.png';
  }

  const icons = Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="icon"]'));
  if (icons.length === 0) {
    const link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
    icons.push(link);
  }
  for (const link of icons) {
    link.type = 'image/png';
    link.sizes = '32x32';
    link.href = href;
    link.dataset.orbState = state;
    link.dataset.liveFavicon = 'true';
  }
}
