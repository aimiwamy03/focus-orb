import { chromium } from 'playwright';
import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const BASE = process.env.MENU_BASE || 'http://localhost:3000';
const OUT = process.env.BACKDROP_SHOTS || '/opt/cursor/artifacts/backdrop';
const ARTIFACTS = '/opt/cursor/artifacts';
await mkdir(OUT, { recursive: true });
await mkdir(ARTIFACTS, { recursive: true });

function fail(message) {
  console.error(`FAIL ${message}`);
  process.exitCode = 1;
}

async function publish(page, fileName) {
  const dest = path.join(ARTIFACTS, fileName);
  await page.screenshot({ path: dest });
  await copyFile(dest, path.join(OUT, fileName));
}

const HINTS = JSON.stringify({
  click: true,
  hover: true,
  fullscreen: true,
  chrome: true,
  'leave-tab': true,
});

function seedScript(options) {
  return (opts) => {
    localStorage.clear();
    sessionStorage.setItem('focusOrb:introPlayed', '1');
    if (opts.shortcutsSeen) localStorage.setItem('focusOrb:shortcutsCard', '1');
    localStorage.setItem('focusOrb:hints', opts.hints);
    if (opts.backdrop === false) localStorage.setItem('focusOrb:showBackdrop', '0');
    if (opts.log) localStorage.setItem('focusOrb:focusLog:mock', opts.log);
  };
}

async function open(browser, search, viewport, options = {}) {
  const page = await browser.newPage({ viewport });
  await page.addInitScript(seedScript(options), {
    shortcutsSeen: options.shortcutsSeen !== false,
    hints: HINTS,
    backdrop: options.backdrop,
    log: options.log ?? null,
  });
  await page.goto(`${BASE}${search}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  return page;
}

function logFixture() {
  const now = Date.now();
  return JSON.stringify([
    {
      id: 'today-spec',
      task: 'write the spec',
      startMs: now - 3 * 60 * 60 * 1000,
      endMs: now - 2 * 60 * 60 * 1000,
      minutes: 50,
      planned: 50,
      ended: 'completed',
    },
  ]);
}

async function contrastNear(page, testId, fg) {
  return page.evaluate(
    ({ testId, fg }) => {
      const el = document.querySelector(`[data-testid="${testId}"]`);
      if (!(el instanceof HTMLElement)) return { ok: false, reason: 'missing' };
      const box = el.getBoundingClientRect();
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(box.width));
      canvas.height = Math.max(1, Math.round(box.height + 24));
      const ctx = canvas.getContext('2d');
      if (!ctx) return { ok: false, reason: 'no ctx' };
      // Sample the page via a 1px probe isn't available; use surrounding
      // computed backdrop pixels from elements behind by reading the
      // screenshot is done in Node. Return the box for Node sampling.
      const toRgb = (hex) => {
        const n = Number.parseInt(hex.slice(1), 16);
        return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
      };
      return {
        ok: true,
        box: { x: box.x, y: box.y, w: box.width, h: box.height },
        fg: toRgb(fg),
        color: getComputedStyle(el).color,
      };
    },
    { testId, fg }
  );
}

function channel(v) {
  const s = v / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function lum(r, g, b) {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(fg, bg) {
  const a = lum(fg.r, fg.g, fg.b);
  const b = lum(bg.r, bg.g, bg.b);
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}

async function sampleBehind(page, box) {
  const shot = await page.screenshot({ type: 'png' });
  const { createRequire } = await import('node:module');
  let Image;
  try {
    Image = (await import('playwright')).default;
  } catch {
    Image = null;
  }
  // Decode via page itself to avoid extra deps.
  return page.evaluate(
    async ({ pngB64, box }) => {
      const img = new Image();
      img.src = `data:image/png;base64,${pngB64}`;
      await img.decode();
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const dpr = img.width / window.innerWidth;
      const samples = [];
      const y0 = Math.round((box.y - 10) * dpr);
      const y1 = Math.round((box.y + box.h + 6) * dpr);
      const x0 = Math.round((box.x - 80) * dpr);
      const x1 = Math.round((box.x + box.w + 80) * dpr);
      for (let y = y0; y < y1; y += 3) {
        for (let x = x0; x < x1; x += 3) {
          if (x < 0 || y < 0 || x >= img.width || y >= img.height) continue;
          const p = ctx.getImageData(x, y, 1, 1).data;
          const L = 0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2];
          if (L < 70) samples.push({ r: p[0], g: p[1], b: p[2] });
        }
      }
      if (!samples.length) return { ok: false, reason: 'no dark samples' };
      const avg = samples.reduce(
        (acc, s) => ({ r: acc.r + s.r, g: acc.g + s.g, b: acc.b + s.b }),
        { r: 0, g: 0, b: 0 }
      );
      const n = samples.length;
      return { ok: true, bg: { r: avg.r / n, g: avg.g / n, b: avg.b / n }, n };
    },
    { pngB64: shot.toString('base64'), box }
  );
}

async function paintFaviconCard(page, fileName) {
  const href = await page.locator('link[rel="icon"]').first().getAttribute('href');
  const state = await page.locator('link[rel="icon"]').first().getAttribute('data-orb-state');
  await page.evaluate(
    ({ href, state }) => {
      const host = document.createElement('div');
      host.setAttribute('data-testid', 'favicon-card');
      host.style.cssText =
        'position:fixed;inset:0;z-index:9999;display:flex;gap:48px;align-items:center;justify-content:center;font-family:system-ui;';
      for (const [label, bg] of [
        ['Light tab bar', '#f4f4f5'],
        ['Dark tab bar', '#18181b'],
      ]) {
        const card = document.createElement('div');
        card.style.cssText = `background:${bg};padding:28px 32px;border-radius:16px;display:flex;flex-direction:column;align-items:center;gap:12px;`;
        const img = document.createElement('img');
        img.src = href;
        img.width = 128;
        img.height = 128;
        img.style.imageRendering = 'pixelated';
        const cap = document.createElement('div');
        cap.textContent = `${label} · ${state}`;
        cap.style.cssText = `color:${bg === '#f4f4f5' ? '#18181b' : '#e4e4e7'};font-size:14px;`;
        card.append(img, cap);
        host.append(card);
      }
      document.body.append(host);
    },
    { href, state }
  );
  await page.waitForTimeout(80);
  await publish(page, fileName);
  await page.evaluate(() => document.querySelector('[data-testid="favicon-card"]')?.remove());
  return state;
}

const browser = await chromium.launch({ args: ['--use-gl=angle'] });

const home = await open(browser, '/?mock=empty', { width: 1280, height: 800 });
if ((await home.getByTestId('star-dust-backdrop').count()) !== 1) {
  fail('Backdrop should render on home by default');
}
if ((await home.getByTestId('orb-root').getAttribute('data-backdrop')) !== 'true') {
  fail('orb-root should mark backdrop on');
}
const heading = await contrastNear(home, 'ask-heading', '#e8e8e8');
const status = await contrastNear(home, 'prompt-context', '#8a8a90');
if (!heading.ok) fail(`heading missing: ${heading.reason}`);
if (!status.ok) fail(`status missing: ${status.reason}`);
const headingBg = await sampleBehind(home, heading.box);
const statusBg = await sampleBehind(home, status.box);
if (!headingBg.ok) fail(`heading sample: ${headingBg.reason}`);
if (!statusBg.ok) fail(`status sample: ${statusBg.reason}`);
const headingRatio = contrast({ r: 232, g: 232, b: 232 }, headingBg.bg);
const statusRatio = contrast({ r: 138, g: 138, b: 144 }, statusBg.bg);
console.log(
  `contrast heading ${headingRatio.toFixed(2)}:1 status ${statusRatio.toFixed(2)}:1 ` +
    `headingBg rgb(${headingBg.bg.r.toFixed(1)},${headingBg.bg.g.toFixed(1)},${headingBg.bg.b.toFixed(1)}) ` +
    `statusBg rgb(${statusBg.bg.r.toFixed(1)},${statusBg.bg.g.toFixed(1)},${statusBg.bg.b.toFixed(1)})`
);
if (headingRatio < 15) fail(`heading contrast ${headingRatio.toFixed(2)} should be >= 15:1`);
if (statusRatio < 5.5) fail(`status contrast ${statusRatio.toFixed(2)} should be around 6:1`);
await publish(home, 'backdrop_home_1280.png');
await copyFile(
  path.join(ARTIFACTS, 'backdrop_home_1280.png'),
  path.join(ARTIFACTS, 'walkthrough_backdrop_home_1280.png')
);
const idleState = await paintFaviconCard(home, 'backdrop_favicon_idle.png');
if (idleState !== 'dense') fail(`idle favicon should be dense/logo B, got ${idleState}`);
await copyFile(
  path.join(ARTIFACTS, 'backdrop_favicon_idle.png'),
  path.join(ARTIFACTS, 'walkthrough_favicon_idle.png')
);

const apple = await home.locator('link[rel="apple-touch-icon"]').getAttribute('href');
if (!apple || !apple.includes('apple-touch-icon')) {
  fail(`apple-touch-icon link missing, got ${apple}`);
}
const manifest = await home.locator('link[rel="manifest"]').getAttribute('href');
if (!manifest || !manifest.includes('manifest')) {
  fail(`manifest link missing, got ${manifest}`);
}
await home.close();

const mobile = await open(browser, '/?mock=empty', { width: 375, height: 812 });
if ((await mobile.getByTestId('star-dust-backdrop').count()) !== 1) {
  fail('Backdrop should render on 375');
}
await publish(mobile, 'backdrop_home_375.png');
await copyFile(
  path.join(ARTIFACTS, 'backdrop_home_375.png'),
  path.join(ARTIFACTS, 'walkthrough_backdrop_home_375.png')
);
await mobile.close();

const tips = await open(browser, '/?mock=empty', { width: 1280, height: 800 }, { shortcutsSeen: false });
await tips.waitForSelector('[data-testid="shortcuts-card"]');
await publish(tips, 'backdrop_tips_corner.png');
await copyFile(
  path.join(ARTIFACTS, 'backdrop_tips_corner.png'),
  path.join(ARTIFACTS, 'walkthrough_backdrop_tips.png')
);
await tips.close();

const focus = await open(browser, '/?mock=empty', { width: 1280, height: 800 });
await focus.getByTestId('focus-task').fill('write the spec');
await focus.getByTestId('duration-50m').click();
await focus.waitForSelector('[data-testid="focus-task-name"]');
await focus.waitForTimeout(400);
if ((await focus.getByTestId('star-dust-backdrop').count()) !== 1) {
  fail('Backdrop should remain during focus');
}
await publish(focus, 'backdrop_focus_1280.png');
await copyFile(
  path.join(ARTIFACTS, 'backdrop_focus_1280.png'),
  path.join(ARTIFACTS, 'walkthrough_backdrop_focus.png')
);
const focusState = await paintFaviconCard(focus, 'backdrop_favicon_focus.png');
if (focusState !== 'focusing') fail(`focus favicon should glow, got ${focusState}`);
await copyFile(
  path.join(ARTIFACTS, 'backdrop_favicon_focus.png'),
  path.join(ARTIFACTS, 'walkthrough_favicon_focus.png')
);
await focus.close();

const logPage = await open(browser, '/?mock=empty', { width: 1280, height: 800 }, { log: logFixture() });
await logPage.mouse.move(1100, 24);
await logPage.waitForTimeout(200);
await logPage.getByTestId('focus-log-open').click();
await logPage.waitForSelector('[data-testid="focus-log"]');
await publish(logPage, 'backdrop_log_1280.png');
await copyFile(
  path.join(ARTIFACTS, 'backdrop_log_1280.png'),
  path.join(ARTIFACTS, 'walkthrough_backdrop_log.png')
);
await logPage.close();

const settings = await open(browser, '/?mock=empty&settings=1', { width: 1280, height: 800 });
await settings.waitForSelector('[data-testid="show-backdrop"]');
const checked = await settings.getByTestId('show-backdrop').isChecked();
if (!checked) fail('Backdrop toggle should default on');
await publish(settings, 'backdrop_settings.png');
await copyFile(
  path.join(ARTIFACTS, 'backdrop_settings.png'),
  path.join(ARTIFACTS, 'walkthrough_backdrop_settings.png')
);
await settings.getByTestId('show-backdrop').click();
await settings.getByLabel('Close').click();
await settings.waitForTimeout(200);
if ((await settings.getByTestId('star-dust-backdrop').count()) !== 0) {
  fail('Turning Backdrop off should fall back to plain black');
}
if ((await settings.getByTestId('orb-root').getAttribute('data-backdrop')) !== 'false') {
  fail('orb-root should mark backdrop off');
}
await publish(settings, 'backdrop_off_black.png');
await settings.close();

const intro = await open(browser, '/?mock=empty&intro=1', { width: 1280, height: 800 });
// override seed that marks intro played — reopen with intro=1 forces play
await intro.close();
const introPage = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await introPage.addInitScript(() => {
  localStorage.clear();
  sessionStorage.clear();
  localStorage.setItem('focusOrb:shortcutsCard', '1');
});
await introPage.goto(`${BASE}/?mock=empty&intro=1`, { waitUntil: 'networkidle' });
await introPage.waitForSelector('[data-testid="focus-intro"]');
if ((await introPage.getByTestId('star-dust-backdrop').count()) !== 1) {
  fail('Backdrop should already be mounted under the intro');
}
if ((await introPage.getByTestId('focus-prompt').count()) !== 1) {
  fail('Home should be under the intro');
}
const introBg = await introPage.getByTestId('focus-intro').evaluate((el) => getComputedStyle(el).backgroundColor);
if (!/rgb\(\s*0,\s*0,\s*0\s*\)/.test(introBg) && introBg !== 'rgb(0, 0, 0)') {
  // allow #000 via computed
  const ok = introBg === 'rgb(0, 0, 0)' || introBg === 'rgba(0, 0, 0, 1)';
  if (!ok) fail(`Intro should keep its own black, got ${introBg}`);
}
await introPage.close();

const mini = await open(browser, '/?mini=1', { width: 1280, height: 800 });
const miniBg = await mini.getByTestId('mini-preview').evaluate((el) => {
  const canvas = el.querySelector('canvas');
  return canvas ? getComputedStyle(canvas).backgroundColor : getComputedStyle(el).backgroundColor;
});
console.log('mini preview bg', miniBg);
await mini.close();

await browser.close();

if (process.exitCode) {
  console.error('e2e backdrop failed');
  process.exit(process.exitCode);
}
console.log('e2e backdrop passed');
console.log(`shots ${OUT}`);
