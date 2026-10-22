import { chromium } from 'playwright';
import { copyFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const BASE = process.env.MENU_BASE || 'http://localhost:3000';
const OUT = process.env.LOG_SHOTS || '/opt/cursor/artifacts/focus-log';
const ARTIFACTS = '/opt/cursor/artifacts';
await mkdir(OUT, { recursive: true });
await mkdir(ARTIFACTS, { recursive: true });

const HINTS = JSON.stringify({
  click: true,
  hover: true,
  fullscreen: true,
  chrome: true,
  'leave-tab': true,
});

const LONG_TASK =
  'Write the production agent launch recap and send it to the lab before standup';

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

function redesignFixture(now) {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const yesterday = addDays(today, -1);
  const hourDay = addDays(today, -2);
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
    entry('yday-done', yesterday, 21, 1, 25, 25, 's', 'completed'),
    entry('yday-early-a', yesterday, 21, 1, 1, 25, 's', 'ended-early'),
    entry('yday-early-b', yesterday, 21, 0, 1, 25, 's', 'ended-early'),
    entry('hour-long', hourDay, 10, 0, 65, 90, LONG_TASK, 'completed'),
    entry('older-plan', earlier, 11, 0, 25, 25, 'plan the week', 'completed'),
  ];
}

function chartFixture(now) {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const extra = (id, daysAgo, minutes, planned, task, ended) => {
    const day = addDays(today, -daysAgo);
    const start = atLocal(day, 10, 0);
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
    ...redesignFixture(now),
    extra('today-chart', 0, 25, 25, 'morning pages', 'completed'),
    extra('d5', 5, 50, 50, 'write the spec', 'completed'),
    extra('d8', 8, 40, 50, 'review pr', 'ended-early'),
    extra('d12', 12, 90, 90, 'Production Agent Lab', 'completed'),
  ];
}

const browser = await chromium.launch({ args: ['--use-gl=angle'] });

async function shot(page, name) {
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
}

async function publish(page, fileName) {
  const dest = path.join(ARTIFACTS, fileName);
  await page.screenshot({ path: dest });
  await copyFile(dest, path.join(OUT, fileName));
}

async function seedPage(page, extra = {}) {
  await page.addInitScript(
    (payload) => {
      localStorage.clear();
      sessionStorage.setItem('focusOrb:introPlayed', '1');
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
if ((await page.getByTestId('focus-log-day-label-Today').count()) !== 1) {
  fail('Empty log should still show Today');
}
if ((await page.getByTestId('focus-log-chart-empty').count()) !== 1) {
  fail('Empty log should show the chart empty copy');
}
await shot(page, 'empty_1280x800');
await publish(page, 'log_chart_empty.png');
await page.setViewportSize({ width: 686, height: 386 });
await page.waitForTimeout(200);
await shot(page, 'empty_686x386');
await page.close();

const fixtureNow = new Date();
const rows = fixture(fixtureNow);
const redesign = redesignFixture(fixtureNow);

page = await openLog({ log: redesign, width: 1280, height: 800 });
if ((await page.getByTestId('focus-log-day-Today').count()) !== 1) {
  fail('Redesign log missing Today');
}
if ((await page.getByTestId('focus-log-empty').count()) !== 1) {
  fail('Today with no sessions should show the empty copy');
}
if ((await page.getByTestId('focus-log-day-total-Today').count()) !== 0) {
  fail('Empty Today should hide the day total');
}
const yesterdayTotal = await page.getByTestId('focus-log-day-total-Yesterday').textContent();
if (yesterdayTotal !== '27m') {
  fail(`Yesterday total should be 27m, got ${yesterdayTotal}`);
}
const ydayLabel = await page.getByTestId('focus-log-day-label-Yesterday').textContent();
if (ydayLabel !== 'Yesterday') {
  fail(`Yesterday should be the short label, got ${ydayLabel}`);
}
const ydayBlock = await page.getByTestId('focus-log-day-Yesterday').textContent();
if (/Wed,|Tue,|Mon,/.test(ydayBlock.split('Yesterday')[0] + 'Yesterday')) {
  /* label itself must not include a grey date */
}
if (ydayBlock.includes('Wed,') || ydayBlock.includes('Tue, Oct')) {
  fail('Yesterday should not show a secondary weekday date');
}
const doneTime = await page.getByTestId('focus-log-time-yday-done').textContent();
if (doneTime !== '9:01–9:26pm') {
  fail(`Finished session should use an en-dash range, got ${doneTime}`);
}
const doneDuration = await page.getByTestId('focus-log-duration-yday-done').textContent();
if (!doneDuration || !/25\smin/.test(doneDuration) || doneDuration.includes('/')) {
  fail(`Finished duration should be minutes only, got ${doneDuration}`);
}
const earlyTime = await page.getByTestId('focus-log-time-yday-early-a').textContent();
if (earlyTime !== '9:01pm') {
  fail(`Stopped-early time should be start only, got ${earlyTime}`);
}
const earlyDuration = await page.getByTestId('focus-log-duration-yday-early-a').textContent();
if (!earlyDuration || !/1\smin\s\/\s25/.test(earlyDuration)) {
  fail(`Stopped-early duration should be 1 min / 25, got ${earlyDuration}`);
}
if ((await page.getByTestId('focus-log-by-task').count()) !== 0) {
  fail('By task summary should not be in the redesigned log');
}
if ((await page.locator('[data-testid^="focus-log-delete-"]').count()) !== 0) {
  fail('Rows should not have a delete control');
}
const barLefts = await page.evaluate(() => {
  const bars = [...document.querySelectorAll('[data-testid^="focus-log-bar-"]')];
  return bars.map((bar) => Math.round(bar.getBoundingClientRect().left));
});
if (barLefts.length < 2 || barLefts.some((left) => Math.abs(left - barLefts[0]) > 1)) {
  fail(`Duration bars should share a column. ${barLefts.join(',')}`);
}
const olderLabelNode = page.locator('[data-testid^="focus-log-day-label-"]').filter({
  hasText: /^[A-Z][a-z]{2}, [A-Z][a-z]{2} \d{1,2}$/,
});
if ((await olderLabelNode.count()) < 1) {
  fail('Older day should use weekday plus date, like Mon, Oct 19');
}
const oldestLabel = olderLabelNode.last();
const hourTotals = page.locator('[data-testid^="focus-log-day-total-"]').filter({ hasText: '1h 5m' });
if ((await hourTotals.count()) !== 1) {
  fail('A day with 65 minutes should show 1h 5m');
}
const longTask = page.getByTestId('focus-log-task-hour-long');
const truncated = await longTask.evaluate((el) => {
  const style = getComputedStyle(el);
  return {
    overflow: el.scrollWidth > el.clientWidth + 1,
    ellipsis: style.textOverflow === 'ellipsis',
    text: el.textContent,
  };
});
if (!truncated.ellipsis || !truncated.overflow) {
  fail(`Long task should truncate with an ellipsis, got ${JSON.stringify(truncated)}`);
}
await page.getByTestId('focus-log-day-Yesterday').scrollIntoViewIfNeeded();
await publish(page, 'log_redesign_today_empty_yesterday.png');
await page.getByTestId('focus-log-task-hour-long').scrollIntoViewIfNeeded();
await publish(page, 'log_redesign_1h5m.png');
await publish(page, 'log_redesign_truncate.png');
await oldestLabel.scrollIntoViewIfNeeded();
await publish(page, 'log_redesign_older_day.png');
await page.getByTestId('focus-log-title').scrollIntoViewIfNeeded();
await page.getByTestId('focus-log-close').hover();
await page.waitForTimeout(150);
await publish(page, 'log_redesign_close_hover.png');
const closeHover = await page.getByTestId('focus-log-close').evaluate((el) => {
  const style = getComputedStyle(el);
  return { bg: style.backgroundColor, color: style.color };
});
if (closeHover.bg === 'rgba(0, 0, 0, 0)' && closeHover.color === 'rgb(180, 180, 185)') {
  fail(`Close hover should brighten, got ${JSON.stringify(closeHover)}`);
}
await page.close();

const chartRows = chartFixture(fixtureNow);
page = await openLog({ log: chartRows, width: 1280, height: 800 });
if ((await page.getByTestId('focus-log-chart').count()) !== 1) {
  fail('Log is missing the 14-day chart');
}
if ((await page.getByTestId('focus-log-chart-title').textContent()) !== 'Last 14 days') {
  fail('Chart header should say Last 14 days');
}
const barCount = await page.locator('[data-testid^="focus-log-chart-bar-"]').count();
if (barCount !== 14) fail(`Chart should have 14 bars, got ${barCount}`);
if ((await page.getByTestId('focus-log-chart-avg').count()) !== 1) {
  fail('Chart should show the session-day average');
}
const layout = await page.evaluate(() => {
  const list = document.querySelector('.focus-log-days').getBoundingClientRect();
  const chart = document.querySelector('[data-testid="focus-log-chart"]').getBoundingClientRect();
  return { listLeft: list.left, chartLeft: chart.left, stacked: chart.bottom <= list.top + 1 };
});
if (layout.chartLeft <= layout.listLeft + 40) {
  fail(`Desktop chart should sit to the right of the list, got ${JSON.stringify(layout)}`);
}
await publish(page, 'log_chart_desktop.png');
const filledBar = page.locator('[data-testid^="focus-log-chart-bar-"][data-empty="false"]').first();
await filledBar.hover();
await page.waitForTimeout(150);
if ((await page.getByTestId('focus-log-chart-tooltip').count()) !== 1) {
  fail('Hovering a bar should show a tooltip');
}
const tip = await page.getByTestId('focus-log-chart-tooltip').textContent();
if (!tip || !tip.includes('·') || tip.includes('—')) {
  fail(`Tooltip should use a middle dot and no em dash, got ${tip}`);
}
await publish(page, 'log_chart_tooltip.png');
await filledBar.focus();
await page.keyboard.press('ArrowLeft');
await page.waitForTimeout(100);
const focusedBars = await page.locator('[data-testid^="focus-log-chart-bar-"][data-highlighted="true"]').count();
if (focusedBars !== 1) fail('Arrow keys should move chart bar focus');
await page.locator('[data-testid="focus-log-title"]').click();
await page.waitForTimeout(100);
await page.setViewportSize({ width: 700, height: 800 });
await page.waitForTimeout(250);
const stacked = await page.evaluate(() => {
  const list = document.querySelector('.focus-log-days').getBoundingClientRect();
  const chart = document.querySelector('[data-testid="focus-log-chart"]').getBoundingClientRect();
  return chart.bottom <= list.top + 8;
});
if (!stacked) fail('Below 760px the chart should stack above the list');
await publish(page, 'log_chart_narrow.png');
await page.close();

page = await openLog({ log: rows, width: 1280, height: 800 });
if ((await page.getByTestId('focus-log-day-Today').count()) !== 1) {
  fail('Fixture log missing Today');
}
const todayTotal = await page.getByTestId('focus-log-day-total-Today').textContent();
if (todayTotal !== '1h 35m') {
  fail(`Today total should be 1h 35m, got ${todayTotal}`);
}
if ((await page.locator('[data-testid^="focus-log-row-"][data-highlighted="true"]').count()) !== 1) {
  fail('A row should start highlighted');
}
const meta = await page.getByTestId('focus-log-meta-today-voice').textContent();
if (!meta || !meta.includes('25 min')) {
  fail(`Session duration missing, got ${meta}`);
}
const time = await page.getByTestId('focus-log-time-today-voice').textContent();
if (time !== '2:10–2:35pm') {
  fail(`Finished range should use an en dash, got ${time}`);
}
await shot(page, 'days_1280x800');
await page.keyboard.press('ArrowDown');
await page.waitForTimeout(150);
await shot(page, 'highlight_1280x800');

const task = page.locator('[data-testid^="focus-log-task-"]').first();
const label = ((await task.getAttribute('title')) || (await task.textContent()) || '').trim();
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
if (!recorded || !recorded.includes('finish voice ai post')) {
  fail(`Ended-early row missing task: ${recorded}`);
}
if (!recorded.includes('/ 25') && !recorded.includes('<1 min')) {
  fail(`Ended-early row should show minutes / planned, got ${recorded}`);
}
if (recorded.includes('ended early')) {
  fail('Ended-early copy should not use the old tag');
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
