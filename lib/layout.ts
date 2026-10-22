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
export const STACK_TOP_PAD_COMPACT = 24;
export const STACK_GAP_COMPACT = 10;

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

export function orbLayout(
  viewW: number,
  viewH: number,
  stackH: number
): OrbLayout {
  const { topPad, gap } = stackInsets(viewH);
  const reserved = Math.max(0, stackH) + topPad + gap;
  const availableH = Math.max(80, viewH - reserved);
  const maxFromViewport = ORB_RADIUS_RATIO * Math.min(viewW, viewH);
  const maxFromStack = availableH * 0.42;
  const floor = viewH < MIN_FIT_HEIGHT ? MIN_RADIUS_COMPACT : MIN_RADIUS;
  let radius = Math.max(floor, Math.min(maxFromViewport, maxFromStack));
  let centerY = topPad + availableH / 2;
  const stackTop = viewH - Math.max(0, stackH);
  const maxUp = Math.max(floor, centerY - 4);
  const maxDown = Math.max(floor, stackTop - centerY - 1);
  radius = Math.min(radius, maxUp, maxDown);
  if (centerY - radius < 4) centerY = radius + 4;
  if (centerY + radius > stackTop) centerY = Math.max(radius + 4, stackTop - radius);
  return {
    radius,
    centerX: viewW / 2,
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
