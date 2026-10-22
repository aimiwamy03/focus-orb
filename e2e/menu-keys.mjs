import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const BASE = process.env.MENU_BASE || 'http://127.0.0.1:3000';
const OUT = process.env.MENU_SHOTS || '/opt/cursor/artifacts/menu-keys';
await mkdir(OUT, { recursive: true });

const SEED = {
  'focusOrb:shortcutsCard': '1',
  'focusOrb:hints': JSON.stringify({
    click: true,
    hover: true,
    fullscreen: true,
    chrome: true,
    'leave-tab': true,
  }),
  'focusOrb:recentTasks': JSON.stringify([
    'finish voice ai post',
    'write the spec',
    'review pr',
  ]),
};

function fail(message) {
  console.error(`FAIL ${message}`);
  process.exitCode = 1;
}

async function seed(page) {
  await page.addInitScript((seed) => {
    localStorage.clear();
    for (const [key, value] of Object.entries(seed)) localStorage.setItem(key, value);
  }, SEED);
}

async function open(page, search) {
  await seed(page);
  await page.goto(`${BASE}${search}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
}

async function highlighted(page, testId) {
  return page.locator(`[data-testid="${testId}"]`).getAttribute('data-highlighted');
}

const browser = await chromium.launch({ args: ['--use-gl=angle'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

await open(page, '/?mock=empty');
const askReady = await page.getByTestId('focus-prompt').count();
if (!askReady) fail('Ask screen did not load');

const initialChip = await highlighted(page, 'duration-50m');
if (initialChip !== 'true') fail(`50m should start highlighted, got ${initialChip}`);

await page.screenshot({ path: path.join(OUT, 'after_ask_initial.png') });

await page.keyboard.press('ArrowRight');
await page.waitForTimeout(150);
if ((await highlighted(page, 'duration-90m')) !== 'true') {
  fail('ArrowRight from first load did not highlight 90m');
}
await page.screenshot({ path: path.join(OUT, 'after_ask_90m.png') });

await page.keyboard.press('ArrowRight');
await page.waitForTimeout(150);
if ((await highlighted(page, 'focus-start')) !== 'true') {
  fail('Second ArrowRight did not highlight Start');
}

const active = await page.evaluate(() => document.activeElement?.getAttribute('data-testid'));
if (active === 'focus-task') {
  fail('Empty-input arrows should have left the task field');
}

await page.keyboard.press('Enter');
await page.waitForTimeout(400);
const focusing = await page.getByTestId('focus-task-name').count();
if (!focusing) fail('Enter from Ask did not start a focus block');
await page.screenshot({ path: path.join(OUT, 'after_ask_started.png') });

await page.locator('[data-testid="orb-canvas"]').click({ position: { x: 640, y: 160 }, force: true });
await page.waitForTimeout(400);
if ((await highlighted(page, 'keep-going')) !== 'true') {
  fail('End-early did not open on Keep going');
}
await page.screenshot({ path: path.join(OUT, 'after_confirm.png') });

await page.keyboard.press('ArrowRight');
await page.waitForTimeout(150);
if ((await highlighted(page, 'end-focus')) !== 'true') {
  fail('ArrowRight on End-early did not highlight End');
}
await page.screenshot({ path: path.join(OUT, 'after_end_highlighted.png') });

await page.keyboard.press('Enter');
await page.waitForTimeout(400);
const completed = await page.getByTestId('focus-completed').textContent();
if (!completed || !completed.includes('Focused')) {
  fail(`Enter on End did not complete the block: ${completed}`);
}
await page.screenshot({ path: path.join(OUT, 'after_ended.png') });

await page.getByTestId('take-break').click();
await page.waitForTimeout(400);
if ((await page.getByTestId('focus-break').count()) !== 1) {
  fail('Done did not open a break');
}

await page.close();

const breakPage = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await open(breakPage, '/?mock=empty&prompt=break');
const breakLabel = await breakPage.getByTestId('focus-break').textContent();
if (!breakLabel || !breakLabel.includes('Break')) fail(`Break status missing: ${breakLabel}`);
if ((await breakPage.getByTestId('end-session').count()) !== 1) {
  fail('Break is missing End session');
}
if ((await highlighted(breakPage, 'end-session')) !== 'true') {
  fail('End session should be highlighted on the break');
}
await breakPage.screenshot({ path: path.join(OUT, 'after_break_exit.png') });

await breakPage.keyboard.press('Escape');
await breakPage.waitForTimeout(200);
if ((await breakPage.getByTestId('end-session-prompt').count()) !== 1) {
  fail('Esc on break did not open End session?');
}
if ((await highlighted(breakPage, 'keep-session')) !== 'true') {
  fail('Keep resting should be the default');
}
await breakPage.screenshot({ path: path.join(OUT, 'after_break_confirm.png') });

await breakPage.keyboard.press('ArrowRight');
await breakPage.waitForTimeout(150);
if ((await highlighted(breakPage, 'end-session')) !== 'true') {
  fail('ArrowRight did not highlight End session on the confirm');
}
await breakPage.keyboard.press('Enter');
await breakPage.waitForTimeout(400);
if ((await breakPage.getByTestId('focus-task').count()) !== 1) {
  fail('Ending the session did not return to the Ask screen');
}
if ((await breakPage.getByTestId('focus-break').count()) !== 0) {
  fail('Break was still visible after End session');
}
await breakPage.screenshot({ path: path.join(OUT, 'after_break_idle.png') });

await breakPage.close();
await browser.close();

if (process.exitCode) {
  console.error('e2e menu-keys failed');
  process.exit(process.exitCode);
}
console.log('e2e menu-keys passed');
console.log(`shots ${OUT}`);
