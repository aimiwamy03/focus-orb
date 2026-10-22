import { chromium } from 'playwright';
import { copyFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const BASE = process.env.MENU_BASE || 'http://localhost:3000';
const OUT = process.env.SHORTCUT_SHOTS || '/opt/cursor/artifacts/shortcut-keys';
const ARTIFACTS = '/opt/cursor/artifacts';
await mkdir(OUT, { recursive: true });
await mkdir(ARTIFACTS, { recursive: true });

function fail(message) {
  console.error(`FAIL ${message}`);
  process.exitCode = 1;
}

async function publish(page, fileName, options = {}) {
  const dest = path.join(ARTIFACTS, fileName);
  await page.screenshot({ path: dest, ...options });
  await copyFile(dest, path.join(OUT, fileName));
}

const HINTS = JSON.stringify({
  click: true,
  hover: true,
  fullscreen: true,
  chrome: true,
  'leave-tab': true,
});

async function boxOf(locator) {
  return locator.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return {
      x: r.x,
      y: r.y,
      w: r.width,
      h: r.height,
      cx: r.x + r.width / 2,
      cy: r.y + r.height / 2,
    };
  });
}

async function capBox(page, testId) {
  return boxOf(page.getByTestId('short-help').getByTestId(testId));
}

const browser = await chromium.launch({ args: ['--use-gl=angle'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.addInitScript((hints) => {
  localStorage.clear();
  sessionStorage.setItem('focusOrb:introPlayed', '1');
  localStorage.setItem('focusOrb:shortcutsCard', '1');
  localStorage.setItem('focusOrb:hints', hints);
}, HINTS);
await page.goto(`${BASE}/?mock=empty&hover=1`, { waitUntil: 'networkidle' });
await page.waitForSelector('[data-testid="help-toggle"]');

const toggle = page.getByTestId('help-toggle');
if ((await toggle.getAttribute('title')) !== null) {
  fail('help-toggle still has a title tooltip');
}
if ((await toggle.getAttribute('aria-label')) !== 'Shortcuts') {
  fail('help-toggle should keep an aria-label');
}

await toggle.click();
await page.waitForSelector('[data-testid="short-help"]');
await page.waitForTimeout(200);

const letters = ['F', 'S', 'P', 'L'];
const squares = {};
for (const letter of letters) {
  squares[letter] = await capBox(page, `keycap-${letter}`);
}
const space = await capBox(page, 'keycap-Space');
const help = await boxOf(page.getByTestId('help-toggle'));

for (const letter of letters) {
  const cap = squares[letter];
  if (Math.abs(cap.w - cap.h) > 0.6) {
    fail(`${letter} is not square: ${cap.w.toFixed(2)}×${cap.h.toFixed(2)}`);
  }
  if (Math.abs(cap.w - squares.F.w) > 0.6 || Math.abs(cap.h - squares.F.h) > 0.6) {
    fail(`${letter} size ${cap.w.toFixed(2)}×${cap.h.toFixed(2)} != F ${squares.F.w.toFixed(2)}×${squares.F.h.toFixed(2)}`);
  }
}

if (Math.abs(space.h - squares.F.h) > 0.6) {
  fail(`Space height ${space.h.toFixed(2)} should match square height ${squares.F.h.toFixed(2)}`);
}
if (space.w <= squares.F.w + 2) {
  fail(`Space should be wider than the squares, got ${space.w.toFixed(2)} vs ${squares.F.w.toFixed(2)}`);
}

if (Math.abs(help.w - squares.F.w) > 1) {
  fail(`? box width ${help.w.toFixed(2)} should match square width ${squares.F.w.toFixed(2)}`);
}
if (Math.abs(help.cx - squares.F.cx) > 1) {
  fail(`? center ${help.cx.toFixed(2)} should line up with F center ${squares.F.cx.toFixed(2)}`);
}

const helpPanel = await page.getByTestId('short-help').boundingBox();
const clip = {
  x: Math.max(0, help.x - 24),
  y: Math.max(0, help.y - 16),
  width: Math.min(420, (helpPanel?.width ?? 280) + 80),
  height: Math.min(360, (helpPanel?.y ?? 80) + (helpPanel?.height ?? 200) - help.y + 40),
};
await publish(page, 'shortcut_keys_zoomed.png', { clip });
await publish(page, 'shortcut_keys_open.png');
await copyFile(
  path.join(ARTIFACTS, 'shortcut_keys_zoomed.png'),
  path.join(ARTIFACTS, 'walkthrough_shortcut_keys_zoomed.png')
);

console.log({
  F: squares.F,
  S: squares.S,
  Space: space,
  P: squares.P,
  L: squares.L,
  help,
});

await browser.close();

if (process.exitCode) {
  console.error('e2e shortcut-keys failed');
  process.exit(process.exitCode);
}
console.log('e2e shortcut-keys passed');
