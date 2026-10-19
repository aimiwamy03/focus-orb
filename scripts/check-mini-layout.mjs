import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const BASE = process.env.LAYOUT_BASE_URL || 'http://localhost:3000';
const OUT_DIRS = [
  path.resolve('artifacts'),
  '/opt/cursor/artifacts',
];
const SIZES = [
  { width: 180, height: 180 },
  { width: 240, height: 180 },
  { width: 320, height: 240 },
];
const PATH =
  '/?mini=1&mock=open-afternoon&now=13:00&prompt=focus&focus=50&task=finish%20voice%20ai%20now';

async function shot(locator, name) {
  const file = `${name}.png`;
  for (const dir of OUT_DIRS) {
    await mkdir(dir, { recursive: true });
    await locator.screenshot({ path: path.join(dir, file) });
  }
  return file;
}

async function setMiniSize(page, width, height) {
  const preview = page.locator('[data-testid="mini-preview"]');
  await preview.waitFor({ state: 'visible' });
  await preview.evaluate(
    (el, size) => {
      el.style.width = `${size.width}px`;
      el.style.height = `${size.height}px`;
    },
    { width, height }
  );
  await page.waitForTimeout(200);
  return preview;
}

async function assertCentered(page, width, height) {
  const info = await page.evaluate(() => {
    const orb = document.querySelector('[data-testid="mini-orb"]');
    const status = document.querySelector('[data-testid="mini-status"]');
    const canvas = document.querySelector('[data-testid="mini-orb-canvas"]');
    if (!(orb instanceof HTMLElement) || !(status instanceof HTMLElement) || !(canvas instanceof HTMLCanvasElement)) {
      throw new Error('mini orb markup missing');
    }
    const orbBox = orb.getBoundingClientRect();
    const statusBox = status.getBoundingClientRect();
    const statusStyle = getComputedStyle(status);
    return {
      orbW: orbBox.width,
      orbH: orbBox.height,
      orbMid: orbBox.left + orbBox.width / 2,
      statusMid: statusBox.left + statusBox.width / 2,
      statusLeft: statusBox.left,
      statusRight: statusBox.right,
      textAlign: statusStyle.textAlign,
      padLeft: statusStyle.paddingLeft,
      padRight: statusStyle.paddingRight,
      canvasW: canvas.width,
      canvasH: canvas.height,
      dpr: window.devicePixelRatio || 1,
    };
  });
  if (Math.abs(info.orbW - width) > 1.5 || Math.abs(info.orbH - height) > 1.5) {
    throw new Error(`mini orb box is ${info.orbW}x${info.orbH}, expected ${width}x${height}`);
  }
  if (Math.abs(info.statusMid - info.orbMid) > 1.5) {
    throw new Error(`status mid ${info.statusMid} is not centered in orb mid ${info.orbMid}`);
  }
  if (info.textAlign !== 'center') {
    throw new Error(`status text-align is ${info.textAlign}`);
  }
  if (info.padLeft !== info.padRight) {
    throw new Error(`status padding ${info.padLeft}/${info.padRight} is not symmetric`);
  }
  if (Math.abs(info.canvasW - Math.round(width * info.dpr)) > 1) {
    throw new Error(`canvas width ${info.canvasW} does not match ${width} * dpr ${info.dpr}`);
  }
  if (Math.abs(info.canvasH - Math.round(height * info.dpr)) > 1) {
    throw new Error(`canvas height ${info.canvasH} does not match ${height} * dpr ${info.dpr}`);
  }
}

const shots = [];
const browser = await chromium.launch({ args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
try {
  await page.addInitScript(() => {
    try {
      localStorage.clear();
    } catch {}
  });
  await page.goto(`${BASE}${PATH}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid="mini-status"]');
  await page.waitForSelector('[data-testid="focus-countdown"]');
  for (const size of SIZES) {
    const preview = await setMiniSize(page, size.width, size.height);
    await assertCentered(page, size.width, size.height);
    shots.push(await shot(preview, `mini_pip_${size.width}x${size.height}`));
  }
  console.log(JSON.stringify({ ok: true, shots }, null, 2));
} finally {
  await browser.close();
}
