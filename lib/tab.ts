import { DayModel, DayState, formatClock, formatCompactDuration, isHeadsUp } from './day';

export type FaviconState = 'dense' | 'scattered' | 'dim';

export { formatCompactDuration };

export function formatLiveTabTitle(
  model: DayModel,
  now: Date,
  options: { isManualFocus?: boolean; focusMinutes?: number | null } = {}
): string {
  if (options.isManualFocus && options.focusMinutes != null) {
    return `Focus ${formatCompactDuration(options.focusMinutes)}`;
  }

  if (isHeadsUp(model, now) && model.nextEvent) {
    return `Join ${model.nextEvent.summary}`;
  }

  if (model.state === 'in-run' && model.currentRun) {
    return `B2B until ${formatClock(model.currentRun.end)}`;
  }

  if (model.state === 'in-meeting' && model.currentEvent) {
    return `In ${model.currentEvent.summary}`;
  }

  if (model.nextBusy && model.nextBusy.events.length >= 2) {
    return `B2B until ${formatClock(model.nextBusy.end)}`;
  }

  if (model.nextEvent && model.gapMinutes != null) {
    return `Free ${formatCompactDuration(model.gapMinutes)}`;
  }

  return 'Clear';
}

export function faviconStateFor(input: {
  scatter: number;
  state: DayState;
}): FaviconState {
  if (input.state === 'in-meeting' || input.state === 'in-run') return 'dim';
  if (input.scatter >= 0.7) return 'dim';
  if (input.scatter >= 0.2) return 'scattered';
  return 'dense';
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const FAVICON_SIZE = 32;
export const FAVICON_SEED = 20261011;

export function drawOrbFavicon(
  ctx: CanvasRenderingContext2D,
  state: FaviconState,
  seed: number = FAVICON_SEED
): void {
  const size = FAVICON_SIZE;
  ctx.fillStyle = '#161616';
  ctx.fillRect(0, 0, size, size);

  const rand = mulberry32(seed);
  const cx = 16;
  const cy = 16;
  const radius = 11;
  const scatter = state === 'dense' ? 0 : state === 'scattered' ? 0.55 : 1;
  const keep = state === 'dense' ? 1 : state === 'scattered' ? 0.7 : 0.45;
  const dim = state === 'dim' ? 0.35 : 1;

  for (let i = 0; i < 420; i++) {
    if (rand() > keep) continue;
    const r = radius * Math.sqrt(rand());
    const theta = rand() * Math.PI * 2;
    let x = r * Math.cos(theta);
    let y = r * Math.sin(theta);
    const radial = r || 1;

    if (scatter > 0) {
      const escape = scatter * radius * (0.2 + rand());
      const mixX = 0.15 * (x / radial) + 0.85 * 0.7071;
      const mixY = 0.15 * (y / radial) + 0.85 * 0.7071;
      x += mixX * escape;
      y += mixY * escape;
    }

    const d = Math.sqrt(x * x + y * y) / radius;
    const z = Math.sqrt(Math.max(0, 1 - Math.min(1, d * d)));
    const lam = Math.max(0, -0.55 * (x / radius) + -0.55 * (y / radius) + 0.63 * z);
    const shade = (0.06 + 0.84 * Math.pow(lam, 1.2)) * dim;
    if (shade < 0.08) continue;

    const px = Math.round(cx + x);
    const py = Math.round(cy + y);
    if (px < 0 || py < 0 || px >= size || py >= size) continue;

    ctx.fillStyle = `rgba(255,255,255,${Math.min(1, shade)})`;
    ctx.fillRect(px, py, 1, 1);
  }
}

export function applyOrbFavicon(state: FaviconState): void {
  if (typeof document === 'undefined') return;
  const canvas = document.createElement('canvas');
  canvas.width = FAVICON_SIZE;
  canvas.height = FAVICON_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  drawOrbFavicon(ctx, state);

  let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.type = 'image/png';
  link.href = canvas.toDataURL('image/png');
  link.dataset.orbState = state;
}
