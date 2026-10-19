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

export function orbLayout(
  viewW: number,
  viewH: number,
  stackH: number
): OrbLayout {
  const reserved = Math.max(0, stackH) + STACK_TOP_PAD + STACK_GAP;
  const availableH = Math.max(120, viewH - reserved);
  const maxFromViewport = ORB_RADIUS_RATIO * Math.min(viewW, viewH);
  const maxFromStack = availableH * 0.42;
  const radius = Math.max(MIN_RADIUS, Math.min(maxFromViewport, maxFromStack));
  return {
    radius,
    centerX: viewW / 2,
    centerY: STACK_TOP_PAD + availableH / 2,
    availableH,
  };
}

export function contentFits(
  viewH: number,
  layout: OrbLayout,
  stackH: number
): boolean {
  const orbBottom = layout.centerY + layout.radius;
  const stackTop = viewH - stackH;
  return orbBottom <= stackTop + 1 && stackH + STACK_TOP_PAD <= viewH;
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
