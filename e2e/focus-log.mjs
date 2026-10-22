import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const BASE = process.env.MENU_BASE || 'http://localhost:3000';
const OUT = process.env.LOG_SHOTS || '/opt/cursor/artifacts/focus-log';
await mkdir(OUT, { recursive: true });

const HINTS = JSON.stringify({
  click: true,
  hover: true,
  fullscreen: true,
  chrome: true,
  'leave-tab': true,
});

function fail(message) {
  console.error(`FAIL ${message}`);
  process.exitCode = 1;
}

function atLocal(day, hours, minutes = 0) {
  const next = new Date(day);
  next.setHours(hours, minutes, 0, 0);
  return next;
}

function addDays(day, days) {
  const next = new Date(day);
  next.setDate(next.getDate() + days);
  next.setHours(0, 0, 0, 0);
  return next;
}

function fixture(now) {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const yesterday = addDays(today, -1);
  const earlier = addDays(today, -3);
  const entry = (id, day, startH, startM, minutes, planned, task, ended) => {
    const start = atLocal(day, startH, startM);
    return {
      id,
      task,
      startMs: start.getTime(),
      endMs: start.getTime() + minutes * 60_000,
      minutes,
      planned,
      ended,
    };
  };
  return [
    entry('today-voice', today, 14, 10, 25, 25, 'finish voice ai post', 'completed'),
    entry('today-spec', today, 10, 0, 50, 50, 'write the spec', 'completed'),
    entry('today-review', today, 16, 5, 20, 50, 'review pr', 'ended-early'),
    entry('yday-voice', yesterday, 9, 30, 50, 50, 'finish voice ai post', 'completed'),
    entry('yday-lab', yesterday, 13, 0, 90, 90, 'Production Agent Lab', 'completed'),
    entry('older-plan', earlier, 11, 0, 25, 25, 'plan the week', 'completed'),
  ];
}

const browser = await chromium.launch({ args: ['--use-gl=angle'] });

async function shot(page, name) {
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
}

async function seedPage(page, extra = {}) {
  await page.addInitScript(
    (payload) => {
      localStorage.clear();
      localStorage.setItem('focusOrb:shortcutsCard', '1');
      localStorage.setItem('focusOrb:hints', payload.hints);
      localStorage.setItem('focusOrb:recentTasks', payload.recents);
      if (payload.log) localStorage.setItem('focusOrb:focusLog:mock', payload.log);
    },
    {
      hints: HINTS,
      recents: JSON.stringify(['finish voice ai post']),
      log: extra.log ? JSON.stringify(extra.log) : '',
    }
  );
}

async function openLog({ log, width, height }) {
  const page = await browser.newPage({ viewport: { width, height } });
  await seedPage(page, { log });
  await page.goto(`${BASE}/?mock=empty&hover=1`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  const logButton = page.getByTestId('focus-log-open');
  if ((await logButton.count()) === 1) {
    await logButton.click();
  } else {
    await page.keyboard.press('Escape');
    await page.keyboard.press('l');
  }
  await page.waitForTimeout(300);
  return page;
}

let page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await seedPage(page);
await page.goto(`${BASE}/?mock=empty&hover=1`, { waitUntil: 'networkidle' });
await page.waitForTimeout(700);
if ((await page.getByTestId('focus-log-open').count()) !== 1) {
  fail('Log chrome control is missing');
}
if ((await page.getByTestId('keycap-L').count()) < 1) {
  fail('Log keycap L should match the P keycap style');
}
await shot(page, 'chrome_1280x800');
await page.getByTestId('focus-log-open').click();
await page.waitForTimeout(300);
if ((await page.getByTestId('focus-log-empty').count()) !== 1) {
  fail('Empty log did not show the empty state');
}
if ((await page.getByTestId('focus-log-close').count()) !== 1) {
  fail('Close control missing on the empty log');
}
await shot(page, 'empty_1280x800');
await page.setViewportSize({ width: 686, height: 386 });
await page.waitForTimeout(200);
await shot(page, 'empty_686x386');
await page.close();

const fixtureNow = new Date();
const rows = fixture(fixtureNow);

page = await openLog({ log: rows, width: 1280, height: 800 });
if ((await page.getByTestId('focus-log-day-Today').count()) !== 1) {
  fail('Fixture log missing Today');
}
const heading = await page.getByTestId('focus-log-day-Today').locator('h3').textContent();
if (!heading || !heading.includes('1h 35m')) {
  fail(`Today heading should include the day total, got ${heading}`);
}
if ((await page.getByTestId('focus-log-by-task').count()) !== 1) {
  fail('Today is missing By task');
}
if ((await page.getByTestId('focus-log-early-today-review').count()) !== 1) {
  fail('Ended-early row should show the quiet tag');
}
if ((await page.locator('[data-testid^="focus-log-row-"][data-highlighted="true"]').count()) !== 1) {
  fail('A row should start highlighted');
}
await shot(page, 'days_1280x800');
await page.keyboard.press('ArrowDown');
await page.waitForTimeout(150);
await shot(page, 'highlight_1280x800');
await page.setViewportSize({ width: 686, height: 386 });
await page.waitForTimeout(200);
await shot(page, 'days_686x386');
await page.keyboard.press('ArrowDown');
await page.waitForTimeout(150);
await shot(page, 'highlight_686x386');

const task = page.locator('[data-testid^="focus-log-task-"]').first();
const label = ((await task.locator('div').first().textContent()) || '').trim();
await task.click();
await page.waitForTimeout(300);
if ((await page.getByTestId('focus-log').count()) !== 0) {
  fail('Picking a task should close the log');
}
const filled = await page.getByTestId('focus-task').inputValue();
if (label && filled !== label) {
  fail(`Picking a task should fill the Ask field. expected ${label}, got ${filled}`);
}
await page.close();

page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await seedPage(page);
await page.goto(`${BASE}/?mock=empty&prompt=done&done=18&planned=25&task=finish%20voice%20ai%20post`, {
  waitUntil: 'networkidle',
});
await page.waitForTimeout(700);
await page.getByTestId('focus-completed').click();
await page.waitForTimeout(300);
if ((await page.getByTestId('focus-log').count()) !== 1) {
  fail('Completed status line did not open the log');
}
await page.keyboard.press('Escape');
await page.waitForTimeout(200);
if ((await page.getByTestId('focus-log').count()) !== 0) {
  fail('Esc did not close the log');
}
await page.keyboard.press('l');
await page.waitForTimeout(200);
if ((await page.getByTestId('focus-log').count()) !== 1) {
  fail('L did not open the log');
}
await page.keyboard.press('l');
await page.waitForTimeout(200);
if ((await page.getByTestId('focus-log').count()) !== 0) {
  fail('L did not close the log');
}
await page.close();

page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await seedPage(page);
await page.goto(`${BASE}/?mock=empty&hover=1&prompt=stop&focus=25&task=finish%20voice%20ai%20post`, {
  waitUntil: 'networkidle',
});
await page.waitForTimeout(800);
if ((await page.getByTestId('end-focus').count()) !== 1) {
  fail('End-early confirm did not open');
}
await page.getByTestId('end-focus').click();
await page.waitForTimeout(400);
await page.keyboard.press('l');
await page.waitForTimeout(300);
if ((await page.getByTestId('focus-log').count()) !== 1) {
  fail('Ended-early block should be in the log');
}
const recorded = await page.locator('[data-testid^="focus-log-row-"]').first().textContent();
if (!recorded || !recorded.includes('finish voice ai post') || !recorded.includes('of 25 min')) {
  fail(`Ended-early row missing task or early minutes: ${recorded}`);
}
if (!recorded.includes('ended early')) {
  fail('Ended-early row should show the quiet tag');
}
await page.close();

page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await seedPage(page);
await page.goto(`${BASE}/?mock=empty&hover=1&prompt=break`, { waitUntil: 'networkidle' });
await page.waitForTimeout(700);
if ((await page.getByTestId('end-session').count()) !== 1) {
  fail('Break is missing End session');
}
await page.getByTestId('end-session').click();
await page.waitForTimeout(200);
await page.getByTestId('end-session').click();
await page.waitForTimeout(300);
await page.keyboard.press('Escape');
await page.waitForTimeout(100);
await page.keyboard.press('l');
await page.waitForTimeout(250);
if ((await page.getByTestId('focus-log-empty').count()) !== 1) {
  fail('Breaks should not be logged as focus');
}
await page.keyboard.press('Escape');
await page.waitForTimeout(200);
await page.close();

page = await openLog({ log: rows, width: 1280, height: 800 });
await page.getByTestId('focus-log-delete-today-review').click();
await page.waitForTimeout(150);
if ((await page.getByTestId('focus-log-delete-confirm').count()) !== 1) {
  fail('Delete should ask first');
}
await page.getByTestId('focus-log-delete-yes').click();
await page.waitForTimeout(200);
if ((await page.getByTestId('focus-log-row-today-review').count()) !== 0) {
  fail('Confirmed delete should remove the row');
}
await page.keyboard.press('Escape');
await page.waitForTimeout(200);
await page.getByTestId('settings-gear').click();
await page.waitForTimeout(200);
await page.getByTestId('clear-log').click();
if ((await page.getByTestId('clear-log-confirm').count()) !== 1) {
  fail('Clear log should ask first');
}
await page.getByTestId('clear-log-yes').click();
await page.waitForTimeout(200);
await page.keyboard.press('Escape');
await page.waitForTimeout(150);
await page.keyboard.press('l');
await page.waitForTimeout(250);
if ((await page.getByTestId('focus-log-empty').count()) !== 1) {
  fail('Clear log should empty the focus log');
}
await page.close();

await browser.close();

if (process.exitCode) {
  console.error('e2e focus-log failed');
  process.exit(process.exitCode);
}
console.log('e2e focus-log passed');
console.log(`shots ${OUT}`);
