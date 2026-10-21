export interface CssBox {
  width: number;
  height: number;
  dpr: number;
}

export function readCssBox(
  el: HTMLElement,
  fallback = 1
): CssBox {
  const win = el.ownerDocument?.defaultView;
  const dpr = win?.devicePixelRatio || 1;
  const width = el.clientWidth || el.parentElement?.clientWidth || 0;
  const height = el.clientHeight || el.parentElement?.clientHeight || 0;
  return {
    width: Math.max(1, width || fallback),
    height: Math.max(1, height || fallback),
    dpr,
  };
}

export function sizeOrbCanvas(
  canvas: HTMLCanvasElement,
  size?: { width: number; height: number; dpr?: number },
  fallback = 1
): CssBox {
  const measured = size ?? readCssBox(canvas, fallback);
  const dpr = measured.dpr ?? 1;
  const width = Math.max(1, measured.width);
  const height = Math.max(1, measured.height);
  const nextW = Math.max(1, Math.round(width * dpr));
  const nextH = Math.max(1, Math.round(height * dpr));
  if (canvas.width !== nextW) canvas.width = nextW;
  if (canvas.height !== nextH) canvas.height = nextH;
  // Fill the parent box. Never size CSS from the backing-store attribute,
  // which is CSS-pixels * dpr and would overflow + shift the orb up-left.
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.display = 'block';
  return { width, height, dpr };
}

export function ensureOrbCanvasSize(
  canvas: HTMLCanvasElement,
  fallback = 1
): CssBox {
  const measured = readCssBox(canvas, fallback);
  const nextW = Math.max(1, Math.round(measured.width * measured.dpr));
  const nextH = Math.max(1, Math.round(measured.height * measured.dpr));
  if (canvas.width !== nextW || canvas.height !== nextH) {
    return sizeOrbCanvas(canvas, measured, fallback);
  }
  return measured;
}

export function backingMatchesCss(
  canvas: Pick<HTMLCanvasElement, 'width' | 'height'>,
  css: Pick<CssBox, 'width' | 'height' | 'dpr'>
): boolean {
  return (
    canvas.width === Math.round(css.width * css.dpr) &&
    canvas.height === Math.round(css.height * css.dpr)
  );
}

export function drawnCenterCss(
  layout: { centerX: number; centerY: number },
  buffer: { width: number; height: number },
  css: { width: number; height: number },
  dpr: number
): { x: number; y: number } {
  const safeW = Math.max(1, buffer.width);
  const safeH = Math.max(1, buffer.height);
  return {
    x: ((layout.centerX * dpr) / safeW) * css.width,
    y: ((layout.centerY * dpr) / safeH) * css.height,
  };
}
