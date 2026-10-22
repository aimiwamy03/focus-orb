export interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface OrbLayout {
  radius: number;
  centerX: number;
  centerY: number;
  availableH: number;
}

export type OrbCloudState = 'free' | 'focusing' | 'meeting-soon';

export const ORB_RADIUS_RATIO = 0.2;
export const MIN_FIT_HEIGHT = 600;
export const STACK_TOP_PAD = 40;
export const STACK_GAP = 12;
export const MIN_RADIUS = 52;
export const MIN_RADIUS_COMPACT = 28;
export const STACK_TOP_PAD_COMPACT = 16;
export const STACK_GAP_COMPACT = 12;
export const MIN_PRESENCE_RADIUS = 28;
export const ORB_EDGE_PAD = 4;
export const ORB_TEXT_GAP = 12;
export const ORB_HALO_RATIO = 1.35;
export const ORB_IDLE_BREATHE = 1.05;
export const ORB_FOCUS_BREATHE = 1.08;
export const ORB_SCATTER_ESCAPE = 1.4;

export function stackInsets(viewH: number): { topPad: number; gap: number } {
  if (viewH < MIN_FIT_HEIGHT) {
    return { topPad: STACK_TOP_PAD_COMPACT, gap: STACK_GAP_COMPACT };
  }
  return { topPad: STACK_TOP_PAD, gap: STACK_GAP };
}

export function cloudBreathe(state: OrbCloudState = 'free'): number {
  return state === 'focusing' ? ORB_FOCUS_BREATHE : ORB_IDLE_BREATHE;
}

/** Gathered-cloud extent from center, including the 1.35 sample halo and breathe. */
export function maxDrawnExtent(
  radius: number,
  state: OrbCloudState = 'free'
): number {
  return radius * ORB_HALO_RATIO * cloudBreathe(state);
}

/** Overlap radius used by the text-clear safety net, including escaped scatter. */
export function textClearCloudRadius(radius: number, scatter = 0): number {
  return radius * ORB_HALO_RATIO * ORB_FOCUS_BREATHE + scatter * radius * ORB_SCATTER_ESCAPE;
}

export function rectsOverlap(a: Rect, b: Rect, slop = 0.5): boolean {
  return (
    a.left < b.right - slop &&
    a.right > b.left + slop &&
    a.top < b.bottom - slop &&
    a.bottom > b.top + slop
  );
}

export function firstOverlappingPair(rects: Rect[]): [number, number] | null {
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      if (rectsOverlap(rects[i], rects[j])) return [i, j];
    }
  }
  return null;
}

export function orbDiskRect(layout: OrbLayout): Rect {
  return {
    left: layout.centerX - layout.radius,
    top: layout.centerY - layout.radius,
    right: layout.centerX + layout.radius,
    bottom: layout.centerY + layout.radius,
  };
}

export function orbLayout(
  viewW: number,
  viewH: number,
  stackH: number
): OrbLayout {
  const { topPad } = stackInsets(viewH);
  const textTop = viewH - Math.max(0, stackH);
  const bandTop = topPad;
  const bandBottom = Math.max(bandTop + 16, textTop - ORB_TEXT_GAP);
  const availableH = Math.max(16, bandBottom - bandTop);
  const cloudRatio = ORB_HALO_RATIO * ORB_FOCUS_BREATHE;
  const maxFromViewport = ORB_RADIUS_RATIO * Math.min(viewW, viewH);
  const maxFromBand = availableH / (2 * cloudRatio);
  const maxFromWidth = Math.max(8, (viewW / 2 - ORB_EDGE_PAD) / cloudRatio);
  const radius = Math.max(8, Math.min(maxFromViewport, maxFromBand, maxFromWidth));
  const cloud = maxDrawnExtent(radius, 'focusing');
  const centerX = viewW / 2;
  let centerY = bandTop + availableH / 2;
  centerY = Math.min(bandBottom - cloud, Math.max(bandTop + cloud, centerY));
  return {
    radius,
    centerX,
    centerY,
    availableH,
  };
}

export function contentFits(
  viewH: number,
  layout: OrbLayout,
  stackH: number,
  state: OrbCloudState = 'free'
): boolean {
  const textTop = viewH - stackH;
  return layout.centerY + maxDrawnExtent(layout.radius, state) <= textTop - ORB_TEXT_GAP + 0.5;
}

export function fullyInsideViewport(
  rect: Rect,
  viewW: number,
  viewH: number,
  slop = 0.5
): boolean {
  return (
    rect.left >= -slop &&
    rect.top >= -slop &&
    rect.right <= viewW + slop &&
    rect.bottom <= viewH + slop
  );
}

export function rectFromDom(el: Pick<DOMRect, 'left' | 'top' | 'right' | 'bottom'>): Rect {
  return {
    left: el.left,
    top: el.top,
    right: el.right,
    bottom: el.bottom,
  };
}
