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

export const ORB_RADIUS_RATIO = 0.2;
export const MIN_FIT_HEIGHT = 600;
export const STACK_TOP_PAD = 56;
export const STACK_GAP = 20;
export const MIN_RADIUS = 52;
export const MIN_RADIUS_COMPACT = 28;
export const STACK_TOP_PAD_COMPACT = 48;
export const STACK_GAP_COMPACT = 10;
export const ORB_EDGE_PAD = 4;

export function stackInsets(viewH: number): { topPad: number; gap: number } {
  if (viewH < MIN_FIT_HEIGHT) {
    return { topPad: STACK_TOP_PAD_COMPACT, gap: STACK_GAP_COMPACT };
  }
  return { topPad: STACK_TOP_PAD, gap: STACK_GAP };
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
  const { topPad, gap } = stackInsets(viewH);
  const stackTop = viewH - Math.max(0, stackH);
  const bandTop = topPad;
  const bandBottom = Math.max(bandTop + 16, stackTop - gap);
  const availableH = Math.max(16, bandBottom - bandTop);
  const maxFromViewport = ORB_RADIUS_RATIO * Math.min(viewW, viewH);
  const maxFromBand = availableH / 2;
  const maxFromWidth = Math.max(8, viewW / 2 - ORB_EDGE_PAD);
  const maxFit = Math.max(8, Math.min(maxFromViewport, maxFromBand, maxFromWidth));
  const radius = maxFit
  const centerX = viewW / 2;
  let centerY = bandTop + availableH / 2;
  centerY = Math.min(bandBottom - radius, Math.max(bandTop + radius, centerY));
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
  stackH: number
): boolean {
  const { topPad } = stackInsets(viewH);
  const orbBottom = layout.centerY + layout.radius;
  const stackTop = viewH - stackH;
  return orbBottom <= stackTop + 1 && stackH + topPad <= viewH;
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
