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
  green: '50m',
  yellow: '40m',
  red: '25m',
  sleep: '30m',
  debt: '30m',
  strain: '50m',
  workout: '20m',
  late: '25m',
};

const browser = await chromium.launch({ args: ['--use-gl=angle'] });

const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

for (const [key, line] of Object.entries(LINES)) {
  await open(page, `/?whoop=${key}`);
  const prompt = page.getByTestId('focus-prompt');
  if ((await prompt.count()) !== 1) fail(`Ask did not load for whoop=${key}`);
  const whoopLine = page.getByTestId('whoop-line');
  if ((await whoopLine.count()) !== 1) fail(`Missing WHOOP line for ${key}`);
  const text = (await whoopLine.textContent())?.trim();
  if (text !== line) fail(`whoop=${key} line: expected "${line}", got "${text}"`);
  const color = await whoopLine.evaluate((el) => getComputedStyle(el).color);
  if (color.includes('rgb(0,') || color.includes('green') || color.includes('red')) {
    fail(`WHOOP line should stay muted, got ${color} for ${key}`);
  }
  const fontSize = await whoopLine.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  if (fontSize < 16.5) fail(`WHOOP line too small at ${fontSize}px for ${key}`);
  if (OFFERS[key]) {
    const offer = page.getByTestId('whoop-offer');
    if ((await offer.count()) !== 1) fail(`Missing WHOOP offer for ${key}`);
    if ((await offer.textContent()) !== OFFERS[key]) {
      fail(`whoop=${key} offer: expected ${OFFERS[key]}, got ${await offer.textContent()}`);
    }
  }
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  if ((await page.getByTestId('whoop-line').count()) !== 0) {
    fail(`Escape should hide the WHOOP line for ${key}`);
  }
}

await open(page, '/?whoop=disconnected');
if ((await page.getByTestId('whoop-line').count()) !== 0) {
  fail('Disconnected mock should not show a WHOOP line');
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
if ((await page.getByTestId('whoop-settings').count()) !== 1) {
  fail('Settings WHOOP section missing');
}
if ((await page.getByTestId('whoop-mode-value').textContent()) !== 'Suggest only') {
  fail('Default mode should be Suggest only');
}
await page.keyboard.press('ArrowDown');
await page.keyboard.press('ArrowRight');
await page.waitForTimeout(200);
if ((await page.getByTestId('whoop-mode-value').textContent()) !== 'Adapt defaults') {
  fail('Right arrow should move to Adapt defaults');
}

await open(page, '/?whoop=disconnected&settings=1');
if ((await page.getByTestId('whoop-status').textContent()) !== 'WHOOP disconnected') {
  fail('Disconnected settings status missing');
}
if (!(await page.getByTestId('whoop-connect').textContent())?.includes('Reconnect')) {
  fail('Disconnected settings should offer Reconnect');
}

await open(page, '/?whoop=calibrating&settings=1');
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
  await publish(mobile, file);
}

await open(page, '/privacy');
if (!(await page.getByRole('heading', { name: 'Privacy' }).count())) {
  fail('Privacy page missing');
}

await browser.close();
if (process.exitCode) process.exit(process.exitCode);
console.log('whoop e2e ok');
