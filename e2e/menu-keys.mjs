import { chromium } from 'playwright';
import { copyFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const BASE = process.env.MENU_BASE || 'http://localhost:3000';
const OUT = process.env.MENU_SHOTS || '/opt/cursor/artifacts/menu-keys';
const ARTIFACTS = '/opt/cursor/artifacts';
await mkdir(OUT, { recursive: true });
await mkdir(ARTIFACTS, { recursive: true });

const LONG_TASK =
  'Write the production agent launch recap and send it to the lab before standup';

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
    's',
    LONG_TASK,
    'finish voice ai post',
  ]),
};

function fail(message) {
  console.error(`FAIL ${message}`);
  process.exitCode = 1;
}

async function seed(page) {
  await page.addInitScript((seed) => {
    localStorage.clear();
    sessionStorage.setItem('focusOrb:introPlayed', '1');
    sessionStorage.setItem('focusOrb:settlePlayed', '1');
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

async function publish(page, fileName) {
  const dest = path.join(ARTIFACTS, fileName);
  await page.screenshot({ path: dest });
  await copyFile(dest, path.join(OUT, fileName));
}

const browser = await chromium.launch({ args: ['--use-gl=angle'] });
const homePage = await browser.newPage({ viewport: { width: 1280, height: 800 } });

await open(homePage, '/?mock=empty');
const askReady = await homePage.getByTestId('focus-prompt').count();
if (!askReady) fail('Ask screen did not load');

const suggestionRow = homePage.getByTestId('recent-tasks');
if ((await suggestionRow.count()) !== 1) fail('Ask suggestions should render in one row');
const suggestionClass = await suggestionRow.getAttribute('class');
if (suggestionClass !== 'ask-suggestions') {
  fail(`Suggestion row should be plain ask-suggestions, got ${suggestionClass}`);
}
const highlightedSuggestions = await homePage.locator('[data-testid^="recent-"][data-highlighted="true"]').count();
if (highlightedSuggestions !== 0) {
  fail('Initial Ask should not highlight a suggestion');
}
const firstSuggestionClass = await homePage.getByTestId('recent-s').getAttribute('class');
if (!firstSuggestionClass || firstSuggestionClass.includes('rounded-full') || firstSuggestionClass.includes('ring-2')) {
  fail(`Suggestion should be plain text, got ${firstSuggestionClass}`);
}
await publish(homePage, 'ask_suggestions_none.png');

await homePage.keyboard.press('ArrowLeft');
await homePage.keyboard.press('ArrowLeft');
await homePage.waitForTimeout(150);
if ((await homePage.getByTestId(`recent-${LONG_TASK}`).getAttribute('data-highlighted')) !== 'true' &&
    (await homePage.getByTestId('recent-finish voice ai post').getAttribute('data-highlighted')) !== 'true') {
  fail('Arrowing onto a suggestion should show keyboard highlight');
}
const keyboardHit = homePage.locator('[data-testid^="recent-"][data-highlighted="true"]');
if ((await keyboardHit.count()) !== 1) fail('Exactly one suggestion should be keyboard-highlighted');
const underline = await keyboardHit.evaluate((el) => {
  const style = getComputedStyle(el);
  const color = style.borderBottomColor;
  const rgb = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)/);
  return {
    color,
    paddingBottom: style.paddingBottom,
    bluish: rgb ? Number(rgb[3]) > Number(rgb[1]) : /oklch|lab/i.test(color),
  };
});
if (!underline.bluish) {
  fail(`Keyboard focus should use the agenda-blue underline, got ${JSON.stringify(underline)}`);
}
await publish(homePage, 'ask_suggestions_keyboard.png');

const longSuggestion = homePage.getByTestId(`recent-${LONG_TASK}`);
const truncated = await longSuggestion.evaluate((el) => {
  const label = el.querySelector('.ask-suggestion-label') || el;
  return {
    overflow: label.scrollWidth > label.clientWidth + 1,
    ellipsis: getComputedStyle(label).textOverflow === 'ellipsis',
  };
});
if (!truncated.ellipsis || !truncated.overflow) {
  fail(`Long suggestion should truncate, got ${JSON.stringify(truncated)}`);
}
await publish(homePage, 'ask_suggestions_truncate.png');
await homePage.close();

const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await open(page, '/?mock=empty');
if (!(await page.getByTestId('focus-prompt').count())) fail('Ask screen did not reload');

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
if ((await page.getByTestId('keep-going').count()) !== 0) {
  fail('Clicking the orb during focus should not open End early');
}
if ((await page.getByTestId('focus-task-name').count()) !== 1) {
  fail('Clicking the orb during focus should leave the session running');
}

await page.keyboard.press(' ');
await page.waitForTimeout(400);
if ((await highlighted(page, 'keep-going')) !== 'true') {
  fail('Space did not open End-early on Keep going');
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

const clickPage = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await open(clickPage, '/?mock=empty');
if ((await highlighted(clickPage, 'duration-50m')) !== 'true') {
  fail('Click-pick reload should start on 50m');
}
await clickPage.keyboard.press('ArrowRight');
await clickPage.waitForTimeout(150);
if ((await highlighted(clickPage, 'duration-90m')) !== 'true') {
  fail('ArrowRight should highlight 90m before the click-pick test');
}
await clickPage.getByTestId('duration-50m').hover();
await clickPage.waitForTimeout(150);
if ((await highlighted(clickPage, 'duration-50m')) !== 'true') {
  fail('Hover should move the highlight to 50m');
}
await publish(clickPage, 'duration_hover_50m.png');
const chipHit = await clickPage.getByTestId('duration-50m').evaluate((el) => {
  const box = el.getBoundingClientRect();
  const style = getComputedStyle(el);
  return { height: box.height, cursor: style.cursor };
});
if (chipHit.height < 44) fail(`Duration hit area should be at least 44px tall, got ${chipHit.height}`);
if (chipHit.cursor !== 'pointer') fail(`Duration chip cursor should be pointer, got ${chipHit.cursor}`);
await clickPage.getByTestId('duration-50m').click();
await clickPage.waitForTimeout(400);
if ((await clickPage.getByTestId('focus-task-name').count()) !== 0) {
  fail('Clicking 50m should select it, not start a session');
}
if ((await highlighted(clickPage, 'duration-50m')) !== 'true') {
  fail('Clicking 50m should keep 50m selected');
}
await publish(clickPage, 'duration_click_50m_selected.png');
await clickPage.getByTestId('focus-start').click();
await clickPage.waitForTimeout(400);
const started = await clickPage.getByTestId('focus-countdown').textContent();
if (!started || !started.includes('50m')) {
  fail(`Start after clicking 50m should begin a 50m block, got ${started}`);
}
await publish(clickPage, 'duration_start_50m.png');
await clickPage.close();

const orbPage = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await open(orbPage, '/?mock=empty');
const orbCursor = await orbPage.locator('[data-testid="orb-canvas"]').evaluate((el) => {
  el.dispatchEvent(new MouseEvent('mousemove', { clientX: 640, clientY: 220, bubbles: true }));
  return getComputedStyle(el).cursor;
});
if (orbCursor === 'pointer') fail(`Orb cursor should not be pointer, got ${orbCursor}`);
await orbPage.locator('[data-testid="orb-canvas"]').click({ position: { x: 640, y: 160 }, force: true });
await orbPage.waitForTimeout(400);
if ((await orbPage.getByTestId('focus-task').count()) !== 1) {
  fail('Clicking the orb on Ask should not start focus');
}
if ((await orbPage.getByTestId('focus-task-name').count()) !== 0) {
  fail('Clicking the orb on Ask started a session');
}
await orbPage.keyboard.press('Enter');
await orbPage.waitForTimeout(400);
if ((await orbPage.getByTestId('focus-task-name').count()) !== 1) {
  fail('Enter should still start focus');
}
await orbPage.locator('[data-testid="orb-canvas"]').click({ position: { x: 640, y: 160 }, force: true });
await orbPage.waitForTimeout(400);
if ((await orbPage.getByTestId('keep-going').count()) !== 0) {
  fail('Clicking the orb during focus should not stop the session');
}
if ((await orbPage.getByTestId('end-session-prompt').count()) !== 0) {
  fail('Clicking the orb during focus should not open End session');
}
if ((await orbPage.getByTestId('focus-task-name').count()) !== 1) {
  fail('Session should still be running after an orb click');
}
await publish(orbPage, 'orb_click_does_nothing.png');
await orbPage.close();

await browser.close();

if (process.exitCode) {
  console.error('e2e menu-keys failed');
  process.exit(process.exitCode);
}
console.log('e2e menu-keys passed');
console.log(`shots ${OUT}`);
