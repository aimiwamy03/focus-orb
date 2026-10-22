export const TEXT_CLEAR_PAD = 12;
export const TEXT_CLEAR_FALLOFF = 16;

export interface ClearRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export function isVisibleClearTarget(el: Element): boolean {
  const win = el.ownerDocument?.defaultView;
  if (!win) return true;
  const style = win.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden') return false;
  if (Number.parseFloat(style.opacity) === 0) return false;
  return true;
}

export function collectTextClearRects(root: ParentNode = document): ClearRect[] {
  const nodes = root.querySelectorAll('[data-text-clear]');
  const rects: ClearRect[] = [];
  for (const node of nodes) {
    if (!isVisibleClearTarget(node)) continue;
    const r = (node as HTMLElement).getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) continue;
    rects.push({ left: r.left, top: r.top, right: r.right, bottom: r.bottom });
  }
  return rects;
}

export function textClearAlpha(
  x: number,
  y: number,
  rects: ClearRect[],
  pad: number = TEXT_CLEAR_PAD,
  falloff: number = TEXT_CLEAR_FALLOFF
): number {
  let alpha = 1;
  for (const r of rects) {
    const left = r.left - pad;
    const right = r.right + pad;
    const top = r.top - pad;
    const bottom = r.bottom + pad;
    const dx = x < left ? left - x : x > right ? x - right : 0;
    const dy = y < top ? top - y : y > bottom ? y - bottom : 0;
    const dist = dx === 0 && dy === 0 ? 0 : Math.hypot(dx, dy);
    if (dist === 0) return 0;
    if (dist < falloff) {
      const t = dist / falloff;
      alpha = Math.min(alpha, t * t * (3 - 2 * t));
    }
  }
  return alpha;
}
