import { collectTextClearRects, textClearAlpha, type ClearRect } from './textClear';
import { MINI_BG, MINI_SIZE } from './miniOrb';

export interface MiniDrawFrame {
  scatter: number;
  density: number;
  dim: boolean;
  scale: number;
  glow: number;
}

interface MiniPoint {
  x: number;
  y: number;
  shade: number;
  threshold: number;
  escapeAt: number;
  scatterSpeed: number;
  scatterAngleJitter: number;
}

const MINI_DOTS = 2200;
const MINI_SEED = 20261011;

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

function makePoints(radius: number): MiniPoint[] {
  const rand = mulberry32(MINI_SEED);
  const points: MiniPoint[] = [];
  const lightX = -0.55;
  const lightY = -0.55;
  const lightZ = 0.63;
  const lightLen = Math.hypot(lightX, lightY, lightZ);
  const Lx = lightX / lightLen;
  const Ly = lightY / lightLen;
  const Lz = lightZ / lightLen;

  for (let i = 0; i < MINI_DOTS; i++) {
    const r = radius * Math.sqrt(rand());
    const theta = rand() * Math.PI * 2;
    const x = r * Math.cos(theta);
    const y = r * Math.sin(theta);
    const d = r / radius;
    const z = Math.sqrt(Math.max(0, 1 - Math.min(1, d * d)));
    const lam = Math.max(0, Lx * (x / radius) + Ly * (y / radius) + Lz * z);
    points.push({
      x,
      y,
      shade: 0.06 + 0.84 * Math.pow(lam, 1.2),
      threshold: rand(),
      escapeAt: rand() * 0.85,
      scatterSpeed: rand(),
      scatterAngleJitter: (rand() - 0.5) * 0.6,
    });
  }
  return points;
}

let cached: { radius: number; points: MiniPoint[] } | null = null;

function pointsFor(radius: number): MiniPoint[] {
  if (cached && Math.abs(cached.radius - radius) < 0.5) return cached.points;
  cached = { radius, points: makePoints(radius) };
  return cached.points;
}

export function sizeMiniCanvas(canvas: HTMLCanvasElement, cssSize: number = MINI_SIZE): number {
  const dpr = (canvas.ownerDocument?.defaultView?.devicePixelRatio || 1);
  canvas.width = Math.round(cssSize * dpr);
  canvas.height = Math.round(cssSize * dpr);
  canvas.style.width = `${cssSize}px`;
  canvas.style.height = `${cssSize}px`;
  return dpr;
}

export function ensureMiniCanvasSize(
  canvas: HTMLCanvasElement,
  cssSize: number = MINI_SIZE
): number {
  const dpr = canvas.ownerDocument?.defaultView?.devicePixelRatio || 1;
  const next = Math.round(cssSize * dpr);
  if (canvas.width !== next || canvas.height !== next) {
    return sizeMiniCanvas(canvas, cssSize);
  }
  return dpr;
}

export function drawMiniOrb(
  ctx: CanvasRenderingContext2D,
  frame: MiniDrawFrame,
  options: { dpr?: number; clearRects?: ClearRect[]; canvasRect?: DOMRect } = {}
): void {
  const { canvas } = ctx;
  const dpr = options.dpr ?? 1;
  const width = canvas.width;
  const height = canvas.height;
  const cx = width / 2;
  const cy = height / 2 - 6 * dpr;
  const radius = Math.min(width, height) * 0.28;
  const points = pointsFor(radius);
  const scatter = frame.scatter;
  const scale = frame.scale;

  ctx.fillStyle = MINI_BG;
  ctx.fillRect(0, 0, width, height);

  if (frame.glow > 0) {
    const glowR = radius * (1.15 + 0.25 * frame.glow);
    const gradient = ctx.createRadialGradient(cx, cy, radius * 0.15, cx, cy, glowR);
    gradient.addColorStop(0, `rgba(255,255,255,${0.22 * frame.glow})`);
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  }

  const canvasRect = options.canvasRect;
  const clearRects = options.clearRects ?? [];
  ctx.fillStyle = '#ffffff';
  const dot = Math.max(1, Math.round(dpr));

  for (const point of points) {
    const progress =
      scatter <= point.escapeAt
        ? 0
        : Math.min(1, (scatter - point.escapeAt) / (1 - point.escapeAt + 1e-6));
    const startingKeep = point.shade * frame.density;
    const keepProb =
      progress === 0
        ? startingKeep * (1 - 0.4 * scatter)
        : startingKeep * (1 - 0.75 * progress);
    if (point.threshold >= keepProb) continue;

    let x = point.x * scale;
    let y = point.y * scale;
    if (progress > 0) {
      const radial = Math.hypot(point.x, point.y) || 1;
      const mixedX = 0.15 * (point.x / radial) + 0.85 * 0.7071;
      const mixedY = 0.15 * (point.y / radial) + 0.85 * 0.7071;
      const mixedLen = Math.hypot(mixedX, mixedY) || 1;
      const cosJ = Math.cos(point.scatterAngleJitter);
      const sinJ = Math.sin(point.scatterAngleJitter);
      const dirX = (mixedX / mixedLen) * cosJ - (mixedY / mixedLen) * sinJ;
      const dirY = (mixedX / mixedLen) * sinJ + (mixedY / mixedLen) * cosJ;
      const escape = progress * radius * (0.3 + 1.1 * point.scatterSpeed);
      x += dirX * escape;
      y += dirY * escape;
    }

    const screenX = cx + x;
    const screenY = cy + y;

    if (clearRects.length > 0 && canvasRect) {
      const cssX = canvasRect.left + (screenX / width) * canvasRect.width;
      const cssY = canvasRect.top + (screenY / height) * canvasRect.height;
      if (textClearAlpha(cssX, cssY, clearRects, 8, 10) <= 0) continue;
    }

    ctx.fillRect(Math.floor(screenX), Math.floor(screenY), dot, dot);
  }

  if (frame.dim) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.72)';
    ctx.fillRect(0, 0, width, height);
  }
}

export function drawMiniOrbOnCanvas(
  canvas: HTMLCanvasElement,
  frame: MiniDrawFrame,
  root: ParentNode = canvas.parentElement ?? document
): void {
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) return;
  const dpr = canvas.width / MINI_SIZE || 1;
  const clearRects = collectTextClearRects(root);
  drawMiniOrb(ctx, frame, {
    dpr,
    clearRects,
    canvasRect: canvas.getBoundingClientRect(),
  });
}
