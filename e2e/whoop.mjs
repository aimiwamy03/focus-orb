import { chromium } from 'playwright';
import { copyFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const BASE = process.env.MENU_BASE || 'http://localhost:3000';
const OUT = process.env.WHOOP_SHOTS || '/opt/cursor/artifacts/whoop';
const ARTIFACTS = '/opt/cursor/artifacts';
await mkdir(OUT, { recursive: true });
await mkdir(ARTIFACTS, { recursive: true });

function fail(message) {
  console.error(`FAIL ${message}`);
  process.exitCode = 1;
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

function parseRgb(color) {
  const m = String(color).match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  return m ? { r: Number(m[1]), g: Number(m[2]), b: Number(m[3]) } : null;
}

const ORB_BG = { r: 22, g: 22, b: 22 };

async function measureMutedType(el, label) {
  const { fontSize, color, className } = await el.evaluate((node) => {
    const style = getComputedStyle(node);
    return { fontSize: parseFloat(style.fontSize), color: style.color, className: node.className };
  });
  if (fontSize < 18) fail(`${label} too small at ${fontSize}px`);
  if (/rounded-full/.test(className) || /\bbadge\b/.test(className)) {
    fail(`${label} should stay plain text, got ${className}`);
  }
  const rgb = parseRgb(color);
  if (!rgb) fail(`${label} color unreadable: ${color}`);
  const ratio = contrast(rgb, ORB_BG);
  if (ratio < 6) fail(`${label} contrast ${ratio.toFixed(2)}:1 is under 6:1 (${color})`);
  return { fontSize, color, ratio };
}

async function assertNoIssueBadge(page, label) {
  const visible = page.getByText(/^\d+\s+Issues?$/);
  if ((await visible.count()) > 0 && (await visible.first().isVisible())) {
    fail(`Next.js issue badge on ${label}: "${(await visible.first().innerText()).trim()}"`);
  }
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

async function seed(page, extra = {}) {
  await page.addInitScript(
    ({ hints, extra }) => {
      localStorage.clear();
      sessionStorage.setItem('focusOrb:introPlayed', '1');
      localStorage.setItem('focusOrb:hints', hints);
      localStorage.setItem('focusOrb:shortcutsCard', '1');
      for (const [key, value] of Object.entries(extra)) localStorage.setItem(key, value);
    },
    { hints: HINTS, extra }
  );
}

async function open(page, search, extra = {}) {
  await seed(page, extra);
  await page.goto(`${BASE}${search}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
}

const LINES = {
  green: 'Recovery 82%. Good day for deep work.',
  yellow: 'Recovery 51%. Steady blocks today.',
  red: 'Recovery 28%. Shorter blocks today.',
  sleep: 'Sleep 62%. Start with something light.',
  debt: 'Short on sleep. Take real breaks today.',
  strain: 'Big day yesterday. Pace yourself.',
  workout: 'Fresh off a workout. Ease in with 20 minutes.',
  late: 'Late in your day. One short block?',
  pending: 'Recovery not ready yet.',
  calibrating: 'Recovery not ready yet.',
};

const OFFERS = {
  green: 'WHOOP suggests 50m',
  yellow: 'WHOOP suggests 40m',
  red: 'WHOOP suggests 25m',
  sleep: 'WHOOP suggests 30m',
  debt: 'WHOOP suggests 30m',
  strain: 'WHOOP suggests 50m',
  workout: 'WHOOP suggests 20m',
  late: 'WHOOP suggests 25m',
};

const browser = await chromium.launch({ args: ['--use-gl=angle'] });

const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

for (const [key, line] of Object.entries(LINES)) {
  await open(page, `/?whoop=${key}`);
  await assertNoIssueBadge(page, `whoop=${key}`);
  const prompt = page.getByTestId('focus-prompt');
  if ((await prompt.count()) !== 1) fail(`Ask did not load for whoop=${key}`);
  const whoopLine = page.getByTestId('whoop-line');
  if ((await whoopLine.count()) !== 1) fail(`Missing WHOOP line for ${key}`);
  const text = (await whoopLine.textContent())?.trim();
  if (text !== line) fail(`whoop=${key} line: expected "${line}", got "${text}"`);
  const lineMeasure = await measureMutedType(whoopLine, `whoop=${key} line`);
  console.log(
    `whoop=${key} line ${lineMeasure.fontSize}px ${lineMeasure.ratio.toFixed(2)}:1 ${lineMeasure.color}`
  );
  if (OFFERS[key]) {
    const offer = page.getByTestId('whoop-offer');
    if ((await offer.count()) !== 1) fail(`Missing WHOOP offer for ${key}`);
    if ((await offer.textContent()) !== OFFERS[key]) {
      fail(`whoop=${key} offer: expected ${OFFERS[key]}, got ${await offer.textContent()}`);
    }
    const offerMeasure = await measureMutedType(offer, `whoop=${key} offer`);
    console.log(
      `whoop=${key} offer ${offerMeasure.fontSize}px ${offerMeasure.ratio.toFixed(2)}:1 ${offerMeasure.color}`
    );
  }
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  if ((await page.getByTestId('whoop-line').count()) !== 0) {
    fail(`Escape should hide the WHOOP line for ${key}`);
  }
}

await open(page, '/?whoop=disconnected');
await assertNoIssueBadge(page, 'whoop=disconnected');
if ((await page.getByTestId('whoop-line').count()) !== 0) {
  fail('Disconnected mock should not show a WHOOP line');
}

await open(page, '/?whoop=red');
await page.keyboard.press('ArrowRight');
await page.keyboard.press('ArrowRight');
if ((await page.getByTestId('whoop-offer').getAttribute('data-highlighted')) !== 'true') {
  fail('Right arrow should reach WHOOP suggests 25m');
}
await page.keyboard.press('Enter');
await page.waitForTimeout(150);
if ((await page.getByTestId('whoop-offer').getAttribute('data-highlighted')) !== 'true') {
  fail('Enter on WHOOP suggests 25m should keep the offer selected');
}
if ((await page.getByTestId('focus-start').getAttribute('data-highlighted')) === 'true') {
  fail('Picking the WHOOP offer should not jump to Start');
}

await open(page, '/?whoop=yellow');
await page.getByTestId('whoop-offer').click();
await page.waitForTimeout(150);
if ((await page.getByTestId('whoop-offer').getAttribute('data-highlighted')) !== 'true') {
  fail('Clicking WHOOP suggests 40m should highlight the offer');
}

await open(page, '/?mock=back-to-back&whoop=red');
if ((await page.getByTestId('whoop-line').textContent()) !== LINES.red) {
  fail('Sample day should combine with whoop=red');
}
if ((await page.getByTestId('sample-day-label').count()) !== 1) {
  fail('Sample day label missing with WHOOP mock');
}

await open(page, '/?whoop=green&settings=1');
await page.waitForTimeout(400);
await assertNoIssueBadge(page, 'settings suggest');
if ((await page.getByTestId('whoop-settings').count()) !== 1) {
  fail('Settings WHOOP section missing');
}
if ((await page.getByTestId('whoop-mode-value').textContent()) !== 'Suggest only') {
  fail('Default mode should be Suggest only');
}
if (!(await page.getByTestId('whoop-mode').textContent())?.includes('‹')) {
  fail('Mode row should show ‹ value ›');
}
if (!(await page.getByTestId('whoop-mode-hint').textContent())?.includes('You still start')) {
  fail('Suggest only should explain that nothing starts on its own');
}
await page.keyboard.press('ArrowDown');
await page.keyboard.press('ArrowRight');
await page.waitForTimeout(200);
if ((await page.getByTestId('whoop-mode-value').textContent()) !== 'Adapt defaults') {
  fail('Right arrow should move to Adapt defaults');
}
if (!(await page.getByTestId('whoop-mode-hint').textContent())?.includes('Pre-fills')) {
  fail('Adapt defaults should explain the pre-fill');
}

await open(page, '/?whoop=disconnected&settings=1');
await assertNoIssueBadge(page, 'settings disconnected');
if ((await page.getByTestId('whoop-status').textContent()) !== 'WHOOP disconnected') {
  fail('Disconnected settings status missing');
}
if (!(await page.getByTestId('whoop-connect').textContent())?.includes('Reconnect')) {
  fail('Disconnected settings should offer Reconnect');
}

await open(page, '/?whoop=calibrating&settings=1');
await assertNoIssueBadge(page, 'settings calibrating');
if ((await page.getByTestId('whoop-status').textContent()) !== 'WHOOP is still learning you') {
  fail('Calibrating settings status missing');
}

const shots = [
  ['/?whoop=green', 'whoop_home_green_1280.png', {}],
  ['/?whoop=red', 'whoop_home_red_1280.png', {}],
  ['/?whoop=workout', 'whoop_home_workout_1280.png', {}],
  ['/?whoop=disconnected&settings=1', 'whoop_settings_disconnected_1280.png', {}],
  ['/?whoop=green&settings=1', 'whoop_settings_suggest_1280.png', {}],
  [
    '/?whoop=green&settings=1',
    'whoop_settings_adapt_1280.png',
    { 'focusOrb:whoopMode': 'adapt' },
  ],
  [
    '/?whoop=red&settings=1',
    'whoop_settings_numbers_off_1280.png',
    { 'focusOrb:whoopShowNumbers': '0' },
  ],
];

for (const [search, file, extra] of shots) {
  await open(page, search, extra);
  await assertNoIssueBadge(page, file);
  await publish(page, file);
}

const mobile = await browser.newPage({ viewport: { width: 375, height: 812 } });
const mobileShots = [
  ['/?whoop=green', 'whoop_home_green_375.png', {}],
  ['/?whoop=red', 'whoop_home_red_375.png', {}],
  ['/?whoop=workout', 'whoop_home_workout_375.png', {}],
  ['/?whoop=disconnected&settings=1', 'whoop_settings_disconnected_375.png', {}],
  ['/?whoop=green&settings=1', 'whoop_settings_suggest_375.png', {}],
  [
    '/?whoop=green&settings=1',
    'whoop_settings_adapt_375.png',
    { 'focusOrb:whoopMode': 'adapt' },
  ],
  [
    '/?whoop=red&settings=1',
    'whoop_settings_numbers_off_375.png',
    { 'focusOrb:whoopShowNumbers': '0' },
  ],
];

for (const [search, file, extra] of mobileShots) {
  await open(mobile, search, extra);
  await assertNoIssueBadge(mobile, file);
  await publish(mobile, file);
}

await open(page, '/privacy');
if (!(await page.getByRole('heading', { name: 'Privacy' }).count())) {
  fail('Privacy page missing');
}

await browser.close();
if (process.exitCode) process.exit(process.exitCode);
console.log('whoop e2e ok');
