import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const BASE = process.env.LAYOUT_BASE_URL || 'http://localhost:3000';
const OUT_DIRS = [
  path.resolve('artifacts'),
  '/opt/cursor/artifacts',
];

function overlap(a, b, slop = 0.5) {
  return (
    a.left < b.right - slop &&
    a.right > b.left + slop &&
    a.top < b.bottom - slop &&
    a.bottom > b.top + slop
  );
}

async function shot(page, name) {
  const file = `${name}.png`;
  for (const dir of OUT_DIRS) {
    await mkdir(dir, { recursive: true });
    await page.screenshot({ path: path.join(dir, file), fullPage: false });
  }
  return file;
}

async function boxOf(page, selector) {
  const loc = page.locator(selector).first();
  if ((await loc.count()) === 0) return null;
  if (!(await loc.isVisible())) return null;
  const box = await loc.boundingBox();
  if (!box) return null;
  return {
    selector,
    left: box.x,
    top: box.y,
    right: box.x + box.width,
    bottom: box.y + box.height,
  };
}

async function assertNoOverlap(page) {
  const pairs = [
    ['[data-testid="focus-prompt"]', '[data-testid="shortcuts-card"]'],
    ['[data-testid="focus-prompt"]', '[data-testid="timeline"]'],
    ['[data-testid="enter-hint"]', '[data-testid="timeline"]'],
    ['[data-testid="space-hint"]', '[data-testid="timeline"]'],
    ['[data-testid="shortcuts-card"]', '[data-testid="timeline"]'],
    ['[data-testid="help-toggle"]', '[data-testid="focus-prompt"]'],
    ['[data-testid="settings-gear"]', '[data-testid="focus-prompt"]'],
    ['[data-testid="fullscreen-toggle"]', '[data-testid="focus-prompt"]'],
    ['[data-testid="pop-out"]', '[data-testid="focus-prompt"]'],
  ];
  for (const [leftSel, rightSel] of pairs) {
    const a = await boxOf(page, leftSel);
    const b = await boxOf(page, rightSel);
    if (!a || !b) continue;
    if (overlap(a, b)) throw new Error(`${leftSel} overlaps ${rightSel}`);
  }
}

async function open(page, search, storage = {}) {
  await page.addInitScript((seed) => {
    try {
      localStorage.clear();
      for (const [key, value] of Object.entries(seed)) {
        localStorage.setItem(key, value);
      }
    } catch {}
    Object.defineProperty(window, 'documentPictureInPicture', {
      configurable: true,
      value: { requestWindow: async () => ({}) },
    });
  }, storage);
  await page.goto(`${BASE}${search}`, { waitUntil: 'domcontentloaded' });
}

const HINTS_SEEN = JSON.stringify({
  click: true,
  hover: true,
  fullscreen: true,
  chrome: true,
  'leave-tab': true,
});

const shots = [];
const browser = await chromium.launch({ args: ['--no-sandbox'] });
try {
  const chromePage = await browser.newPage({ viewport: { width: 1280, height: 640 } });
  await open(chromePage, '/?mock=open-afternoon&now=13:00&hover=1', {
    'focusOrb:shortcutsCard': '1',
    'focusOrb:hints': HINTS_SEEN,
  });
  await chromePage.waitForSelector('[data-testid="keycap-P"]');
  await chromePage.waitForSelector('[data-testid="keycap-F"]');
  await chromePage.waitForSelector('[data-testid="keycap-S"]');
  await chromePage.waitForSelector('[data-testid="enter-hint"]');
  const helpTitle = await chromePage.locator('[data-testid="help-toggle"]').getAttribute('title');
  if (helpTitle) throw new Error(`? native tooltip should be gone, got ${helpTitle}`);
  const helpAria = await chromePage.locator('[data-testid="help-toggle"]').getAttribute('aria-label');
  if (helpAria !== 'Shortcuts') throw new Error(`? aria-label is ${helpAria}`);
  if ((await chromePage.locator('[data-testid="shortcuts-card"]').count()) > 0) {
    throw new Error('shortcuts card showed after it was marked seen');
  }
  await assertNoOverlap(chromePage);
  shots.push(await shot(chromePage, 'shortcuts_chrome_1280x640'));
  await chromePage.close();

  const cardPage = await browser.newPage({ viewport: { width: 1280, height: 640 } });
  await open(cardPage, '/?mock=open-afternoon&now=13:00', {
    'focusOrb:hints': HINTS_SEEN,
  });
  await cardPage.waitForSelector('[data-testid="shortcuts-card"]');
  await cardPage.getByText('Got it').waitFor();
  await assertNoOverlap(cardPage);
  shots.push(await shot(cardPage, 'shortcuts_first_run_card'));
  await cardPage.close();

  const focusPage = await browser.newPage({ viewport: { width: 1280, height: 640 } });
  await open(
    focusPage,
    '/?mock=open-afternoon&now=13:00&hover=1&prompt=focus&focus=32.9&task=Deep%20work',
    {
      'focusOrb:shortcutsCard': '1',
      'focusOrb:hints': HINTS_SEEN,
    }
  );
  await focusPage.waitForSelector('[data-testid="space-hint"]');
  await focusPage.waitForSelector('[data-testid="focus-countdown"]');
  await assertNoOverlap(focusPage);
  shots.push(await shot(focusPage, 'shortcuts_focusing_space'));
  await focusPage.close();

  console.log(JSON.stringify({ ok: true, shots }, null, 2));
} finally {
  await browser.close();
}
