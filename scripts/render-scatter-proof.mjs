import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const GATHER_MS = 2000;
const MAX_DELTA = 0.55;
const DURATION = 10_000;
const FRAME = 16;

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function fromGather(target, gatherLeft) {
  const gatherT = gatherLeft <= 0 ? 0 : (gatherLeft / GATHER_MS) ** 2;
  return clamp01(gatherT + (1 - gatherT) * target);
}

function step(visual, target, dt) {
  const maxStep = (MAX_DELTA * dt) / 1000;
  const delta = target - visual;
  if (Math.abs(delta) <= maxStep) return clamp01(target);
  return clamp01(visual + Math.sign(delta) * maxStep);
}

function series(kind, target) {
  const values = [];
  let visual = target;
  let gatherUntil = 0;
  for (let t = 0; t <= DURATION; t += FRAME) {
    if (kind === 'bug' && t % 400 < FRAME) gatherUntil = t + GATHER_MS;
    visual =
      kind === 'bug'
        ? fromGather(target, gatherUntil - t)
        : step(visual, target, FRAME);
    values.push(visual);
  }
  return values;
}

function chartSvg(rows) {
  const w = 960;
  const h = 220;
  const pad = 28;
  const innerW = w - pad * 2;
  const innerH = h - pad * 2;
  const colors = {
    bug: '#d46a6a',
    fix: '#8fbf8f',
  };
  const polylines = rows
    .map(({ name, values }) => {
      const points = values
        .map((v, i) => {
          const x = pad + (i / (values.length - 1)) * innerW;
          const y = pad + (1 - v) * innerH;
          return `${x.toFixed(1)},${y.toFixed(1)}`;
        })
        .join(' ');
      return `<polyline fill="none" stroke="${colors[name]}" stroke-width="2" points="${points}" />`;
    })
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <rect width="${w}" height="${h}" fill="#161616" />
    <text x="${pad}" y="18" fill="#888" font-family="system-ui" font-size="12">scatter over 10s (free, target 0)</text>
    <text x="${w - 210}" y="18" fill="#d46a6a" font-family="system-ui" font-size="12">production remount gather</text>
    <text x="${w - 210}" y="34" fill="#8fbf8f" font-family="system-ui" font-size="12">fixed ease</text>
    ${polylines}
  </svg>`;
}

const OUT_DIRS = [path.resolve('artifacts'), '/opt/cursor/artifacts'];

async function main() {
  const bug = series('bug', 0);
  const fix = series('fix', 0);
  const svg = chartSvg([
    { name: 'bug', values: bug },
    { name: 'fix', values: fix },
  ]);

  for (const dir of OUT_DIRS) {
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, 'scatter_oscillation_chart.svg'), svg);
  }

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 960, height: 220 } });
  await page.setContent(`<html><body style="margin:0">${svg}</body></html>`);
  const png = await page.screenshot({ type: 'png' });
  await browser.close();
  for (const dir of OUT_DIRS) {
    await writeFile(path.join(dir, 'scatter_oscillation_chart.png'), png);
  }
  console.log('wrote scatter_oscillation_chart.png');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
