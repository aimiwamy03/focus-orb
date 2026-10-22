import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const BASE = process.env.LAYOUT_BASE_URL || 'http://localhost:3000';
const OUT_DIRS = [path.resolve('artifacts'), '/opt/cursor/artifacts'];
const SAMPLE_MS = 100;
const SAMPLE_COUNT = 40;
const FRAME_COUNT = 12;
const FRAME_EVERY = 3;

const STATES = [
  { name: 'free', path: '/?mock=open-afternoon&now=11:00' },
  {
    name: 'focusing',
    path: '/?mock=open-afternoon&now=11:00&prompt=focus&focus=50&task=Deep%20work',
  },
  { name: 'meeting-soon', path: '/?mock=pre-meeting&now=13:22' },
];

async function writeOut(name, bytes) {
  for (const dir of OUT_DIRS) {
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, name), bytes);
  }
}

async function waitForOrb(page) {
  await page.addInitScript(() => {
    localStorage.setItem('focusOrb:shortcutsCard', '1');
    localStorage.setItem('focusOrb:scatterWindow', '60');
  });
  await page.waitForFunction(() => {
    const canvas = document.querySelector('[data-testid="orb-canvas"]');
    return canvas instanceof HTMLCanvasElement && canvas.width > 200;
  });
  await page.waitForTimeout(700);
}

function spreadFromCanvas() {
  const canvas = document.querySelector('[data-testid="orb-canvas"]');
  if (!(canvas instanceof HTMLCanvasElement)) throw new Error('orb canvas missing');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('orb ctx missing');
  const { width, height } = canvas;
  const data = ctx.getImageData(0, 0, width, height).data;
  let count = 0;
  let moment = 0;
  const cx = width / 2;
  const cy = height / 2;
  const maxR = Math.hypot(cx, cy) || 1;
  for (let y = 0; y < height; y += 3) {
    for (let x = 0; x < width; x += 3) {
      const i = (y * width + x) * 4;
      if (data[i] + data[i + 1] + data[i + 2] < 80) continue;
      count += 1;
      moment += Math.hypot(x - cx, y - cy);
    }
  }
  const hook = window.__orbScatter;
  return {
    spread: count ? moment / count / maxR : 0,
    visual: hook?.visual ?? null,
    target: hook?.target ?? null,
  };
}

function grabFrame(size) {
  const src = document.querySelector('[data-testid="orb-canvas"]');
  if (!(src instanceof HTMLCanvasElement)) throw new Error('orb canvas missing');
  const dest = document.createElement('canvas');
  dest.width = size;
  dest.height = size;
  const ctx = dest.getContext('2d');
  const sx = Math.max(0, Math.round(src.width / 2 - size / 2));
  const sy = Math.max(0, Math.round(src.height / 2 - size / 2));
  ctx.drawImage(src, sx, sy, size, size, 0, 0, size, size);
  return dest.toDataURL('image/png');
}

function analyze(samples) {
  const values = samples.map((s) => (s.visual == null ? s.spread : s.visual));
  let signFlips = 0;
  let prevSign = 0;
  let maxAbsDelta = 0;
  let min = values[0] ?? 0;
  let max = values[0] ?? 0;
  for (let i = 1; i < values.length; i++) {
    min = Math.min(min, values[i]);
    max = Math.max(max, values[i]);
    const d = values[i] - values[i - 1];
    maxAbsDelta = Math.max(maxAbsDelta, Math.abs(d));
    const sign = d > 1e-4 ? 1 : d < -1e-4 ? -1 : 0;
    if (sign && prevSign && sign !== prevSign && Math.abs(d) > 0.01) signFlips += 1;
    if (sign) prevSign = sign;
  }
  return { min, max, range: max - min, maxAbsDelta, signFlips, values };
}

async function sampleState(page, state, pip) {
  await page.goto(`${BASE}${state.path}`, { waitUntil: 'networkidle' });
  await waitForOrb(page);
  if (pip) {
    const button = page.getByRole('button', { name: /pop out/i });
    if (await button.count()) {
      await button.click({ trial: true }).catch(() => {});
      await button.click().catch(() => {});
    }
  }
  await page.waitForTimeout(400);

  const samples = [];
  const frames = [];
  for (let i = 0; i < SAMPLE_COUNT; i++) {
    samples.push(await page.evaluate(spreadFromCanvas));
    if (i % FRAME_EVERY === 0 && frames.length < FRAME_COUNT) {
      frames.push(await page.evaluate(grabFrame, 220));
    }
    await page.waitForTimeout(SAMPLE_MS);
  }
  return { samples, frames, analysis: analyze(samples), pip };
}

async function writeStrip(name, frames) {
  const browser = await chromium.launch({ args: ['--use-gl=angle'] });
  const page = await browser.newPage({ viewport: { width: 220 * frames.length, height: 220 } });
  const imgs = frames
    .map((src, i) => `<img alt="f${i}" src="${src}" width="220" height="220" />`)
    .join('');
  await page.setContent(
    `<html><body style="margin:0;display:flex;background:#161616">${imgs}</body></html>`
  );
  const bytes = await page.screenshot({ type: 'png' });
  await browser.close();
  await writeOut(name, bytes);
}

async function main() {
  const browser = await chromium.launch({ args: ['--use-gl=angle'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const report = { base: BASE, states: {} };

  for (const state of STATES) {
    for (const pip of [false, true]) {
      const key = pip ? `${state.name}-pip` : state.name;
      const result = await sampleState(page, state, pip);
      report.states[key] = {
        pip,
        analysis: result.analysis,
        samples: result.samples,
      };
      await writeStrip(`scatter_strip_${key}.png`, result.frames);
    }
  }

  await browser.close();
  await writeOut('scatter_flicker_samples.json', JSON.stringify(report, null, 2));

  const failures = Object.entries(report.states).filter(([, value]) => {
    return value.analysis.signFlips > 2 || value.analysis.range > 0.35;
  });
  console.log(JSON.stringify(report.states, null, 2));
  if (failures.length && process.env.SKIP_ASSERT !== '1') {
    throw new Error(
      `scatter flicker in ${failures.map(([name]) => name).join(', ')}`
    );
  }
  if (failures.length) {
    console.warn(`flicker detected: ${failures.map(([name]) => name).join(', ')}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
