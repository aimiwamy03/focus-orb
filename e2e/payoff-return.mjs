import { chromium } from 'playwright';
import { copyFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const BASE = process.env.MENU_BASE || 'http://localhost:3000';
const OUT = process.env.PAYOFF_SHOTS || '/opt/cursor/artifacts/payoff-return';
const ARTIFACTS = '/opt/cursor/artifacts';
await mkdir(OUT, { recursive: true });
await mkdir(ARTIFACTS, { recursive: true });

function fail(message) {
  console.error(`FAIL ${message}`);
  process.exitCode = 1;
}

async function publish(page, fileName) {
  const dest = path.join(ARTIFACTS, fileName);
  await page.screenshot({ path: dest, animations: 'disabled' });
  await copyFile(dest, path.join(OUT, fileName));
}

function dayStart(offsetDays, hours = 10) {
  const day = new Date();
  day.setHours(0, 0, 0, 0);
  day.setDate(day.getDate() + offsetDays);
  day.setHours(hours, 0, 0, 0);
  return day.getTime();
}

function counted(id, startMs, task, nextStep) {
  return {
    id,
    task,
    startMs,
    endMs: startMs + 50 * 60_000,
    minutes: 50,
    planned: 50,
    ended: 'completed',
    ...(nextStep ? { nextStep } : {}),
  };
}

const HINTS = JSON.stringify({
  click: true,
  hover: true,
  fullscreen: true,
  chrome: true,
  'leave-tab': true,
});

function seedScript(log) {
  return (payload) => {
    localStorage.clear();
    sessionStorage.setItem('focusOrb:introPlayed', '1');
    sessionStorage.setItem('focusOrb:settlePlayed', '1');
    localStorage.setItem('focusOrb:shortcutsCard', '1');
    localStorage.setItem('focusOrb:hints', payload.hints);
    if (payload.soundOff) localStorage.setItem('focusOrb:introSound', '0');
    if (payload.log) localStorage.setItem('focusOrb:focusLog:mock', payload.log);
  };
}

const browser = await chromium.launch({ args: ['--use-gl=angle'] });

async function open(search, { log, soundOff, reduced, viewport } = {}) {
  const page = await browser.newPage({
    viewport: viewport ?? { width: 1280, height: 800 },
  });
  if (reduced) await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(seedScript(log), {
    hints: HINTS,
    soundOff: Boolean(soundOff),
    log: log ? JSON.stringify(log) : '',
  });
  await page.goto(`${BASE}${search}`, { waitUntil: 'domcontentloaded' });
  await page.getByTestId('orb-root').waitFor({ timeout: 8000 });
  await page.waitForTimeout(400);
  return page;
}

const bloom = await open('/?mock=empty&intro=0&settle=0&end=1&orbT=0.9&task=Write%20the%20spec');
await bloom.locator('[data-testid="orb-root"][data-orb-moment="bloom"]').waitFor({ timeout: 8000 });
const bloomRoot = bloom.getByTestId('orb-root');
if ((await bloomRoot.getAttribute('data-orb-moment')) !== 'bloom') {
  fail('?end=1 should play the finished-block bloom');
}
const bloomBright = Number(await bloomRoot.getAttribute('data-orb-brightness'));
if (!(bloomBright >= 0.99)) {
  fail(`Finished block should hit brightness 1.0, got ${bloomBright}`);
}
if ((await bloom.getByTestId('next-step').count()) !== 0) {
  fail('Recap should wait until the bloom ends');
}
await publish(bloom, 'end_moment_after_1280.png');
await bloom.close();

const bloomMobile = await open('/?mock=empty&intro=0&settle=0&end=1&orbT=0.9&task=Write%20the%20spec', {
  viewport: { width: 390, height: 844 },
});
await publish(bloomMobile, 'end_moment_after_390.png');
await bloomMobile.close();

const early = await open('/?mock=empty&intro=0&settle=0&prompt=done&done=18&planned=50&task=Write%20the%20spec');
await early.getByTestId('next-step').waitFor({ timeout: 1500 });
const earlyRoot = early.getByTestId('orb-root');
if ((await earlyRoot.getAttribute('data-orb-moment')) !== 'still') {
  fail('An early stop should keep the still moment, with no climax');
}
const earlyBright = Number(await earlyRoot.getAttribute('data-orb-brightness'));
if (!(earlyBright < 1)) {
  fail(`Early stop should keep today's small glow, got brightness ${earlyBright}`);
}
if ((await early.getByTestId('next-step').count()) !== 1) {
  fail('Early stop should go straight to the recap');
}
await early.close();

const reduced = await open('/?mock=empty&intro=0&settle=0&end=1&task=Write%20the%20spec', {
  reduced: true,
});
await reduced.getByTestId('next-step').waitFor({ timeout: 1500 });
if ((await reduced.getByTestId('orb-root').getAttribute('data-orb-moment')) !== 'still') {
  fail('prefers-reduced-motion should skip the bloom');
}
if ((await reduced.getByTestId('next-step').count()) !== 1) {
  fail('prefers-reduced-motion should go straight to the recap');
}
await reduced.close();

const streakLog = [
  counted('d0', dayStart(0), 'Write the spec'),
  counted('d1', dayStart(-1), 'finish voice ai post', 'Send the recap'),
  counted('d2', dayStart(-2), 'plan the week'),
];
const home = await open('/?mock=empty&intro=0&settle=0', { log: streakLog });
await home.getByTestId('return-line').waitFor({ timeout: 8000 });
const returnLine = await home.getByTestId('return-line').textContent();
if (returnLine !== '50m today · 3 day streak') {
  fail(`Home should show today's minutes and streak, got ${returnLine}`);
}
if (returnLine.match(/[—–]/)) fail('Return line should not use an em dash');
if ((await home.getByTestId('ask-yesterday-task').textContent()) !== 'finish voice ai post') {
  fail('Home should keep yesterday chips under the empty task box');
}
await publish(home, 'home_streak_after_1280.png');
await home.close();

const homeEmptyTask = [
  counted('d1', dayStart(-1), 'finish voice ai post', 'Send the recap'),
  counted('d2', dayStart(-2), 'plan the week'),
];
const suggest = await open('/?mock=empty&intro=0&settle=0', { log: homeEmptyTask });
await suggest.getByTestId('return-line').waitFor({ timeout: 8000 });
const homeQuiet = await suggest.getByTestId('return-line').textContent();
if (homeQuiet !== '0m today · 2 day streak') {
  fail(`Empty today should keep yesterday's live streak, got ${homeQuiet}`);
}
if ((await suggest.getByTestId('ask-yesterday-task').textContent()) !== 'finish voice ai post') {
  fail('Yesterday last task should appear under the empty box');
}
if ((await suggest.getByTestId('ask-yesterday-note').textContent()) !== 'Send the recap') {
  fail('Yesterday stop note should appear under the empty box');
}
if ((await suggest.getByTestId('recent-tasks').count()) !== 0) {
  fail('Yesterday chips should replace recents so the landing stays calm');
}
await suggest.getByTestId('ask-yesterday-task').click();
if ((await suggest.getByTestId('focus-task').inputValue()) !== 'finish voice ai post') {
  fail('Tapping yesterday task should fill the box');
}
await suggest.getByTestId('focus-task').fill('');
await suggest.getByTestId('ask-yesterday-note').click();
if ((await suggest.getByTestId('focus-task').inputValue()) !== 'Send the recap') {
  fail('Tapping yesterday note should fill the box');
}
await publish(suggest, 'home_yesterday_after_1280.png');
const suggestMobile = await open('/?mock=empty&intro=0&settle=0', {
  log: homeEmptyTask,
  viewport: { width: 390, height: 844 },
});
await publish(suggestMobile, 'home_streak_after_390.png');
await suggest.close();
await suggestMobile.close();

const endStreak = await open(
  '/?mock=empty&intro=0&settle=0&prompt=done&done=50&planned=50&task=Write%20the%20spec',
  { log: streakLog }
);
await endStreak.getByTestId('focused-today').waitFor({ timeout: 8000 });
const endToday = await endStreak.getByTestId('focused-today').textContent();
if (endToday !== '50m focused today · 3 day streak') {
  fail(`End screen should keep the streak, got ${endToday}`);
}
await endStreak.close();

await browser.close();
if (process.exitCode) {
  console.error('e2e payoff-return failed');
  process.exit(process.exitCode);
}
console.log('e2e payoff-return passed');
