import { chromium } from 'playwright';
import { copyFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const BASE = process.env.MENU_BASE || 'http://localhost:3000';
const OUT = process.env.START_SHOTS || '/opt/cursor/artifacts/start-focusing';
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

async function seedFirstOpen(page) {
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('focusOrb:shortcutsCard', '1');
  });
}

async function openLanding(page, search = '/?intro=0') {
  await seedFirstOpen(page);
  await page.goto(`${BASE}${search}`, { waitUntil: 'domcontentloaded' });
  if (search.includes('intro=1') && !search.includes('t=')) {
    await page.getByTestId('focus-intro').waitFor();
    await page.getByTestId('focus-intro-hint').click();
    await page.getByTestId('focus-intro').waitFor({ state: 'detached', timeout: 4000 });
  }
  await page.getByTestId('focus-task').waitFor({ timeout: 8000 });
}

async function assertLanding(page, label) {
  if ((await page.getByTestId('start-focusing').count()) !== 0) {
    fail(`${label}: Start focusing should be gone`);
  }
  if ((await page.locator("text=What's the one thing?").count()) !== 1) {
    fail(`${label}: landing should show What's the one thing?`);
  }
  const start = page.getByTestId('focus-start');
  const metrics = await start.evaluate((el) => {
    const style = getComputedStyle(el);
    const inner = el.querySelector('span');
    const innerStyle = inner ? getComputedStyle(inner) : style;
    return {
      font: parseFloat(innerStyle.fontSize),
      radius: innerStyle.borderRadius,
      className: `${el.className} ${inner?.className || ''}`,
    };
  });
  if (metrics.font < 17) fail(`${label}: Start should be 17px+, got ${metrics.font}`);
  if (metrics.className.includes('rounded-full') || metrics.radius !== '0px') {
    fail(`${label}: Start should not be a pill, radius ${metrics.radius}`);
  }
  for (const minutes of [25, 50, 90]) {
    if ((await page.getByTestId(`duration-${minutes}m`).count()) !== 1) {
      fail(`${label}: ${minutes}m should be ready`);
    }
  }
  if ((await page.getByTestId('duration-custom').count()) !== 1) {
    fail(`${label}: Custom should be in the duration row`);
  }
  if ((await page.getByTestId('replay-intro').count()) !== 1) {
    fail(`${label}: Replay intro should be visible`);
  }
  if ((await page.getByTestId('sample-day').count()) !== 1) {
    fail(`${label}: Sample day should stay secondary`);
  }
  if ((await page.getByTestId('voice-mic').count()) !== 0) {
    fail(`${label}: mic should stay hidden without a voice key`);
  }
}

const browser = await chromium.launch({ args: ['--use-gl=angle'] });

for (const [width, height, tag] of [
  [1280, 800, '1280'],
  [390, 844, '390'],
]) {
  const page = await browser.newPage({
    viewport: { width, height },
    hasTouch: width === 390,
    isMobile: width === 390,
  });
  await openLanding(page, '/?intro=1');
  await assertLanding(page, tag);
  await publish(page, `landing_after_${tag}.png`);
  await page.close();
}

const focusPage = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await openLanding(focusPage, '/?intro=0');
await focusPage.getByTestId('focus-task').evaluate((el) => el.blur());
await focusPage.waitForTimeout(80);
await focusPage.keyboard.press('Enter');
if ((await focusPage.getByTestId('focus-countdown').count()) !== 0) {
  fail('enter: should focus the task, not start a block');
}
const focusedEnter = await focusPage.getByTestId('focus-task').evaluate((el) => document.activeElement === el);
if (!focusedEnter) fail('enter: task input should be focused');
await focusPage.getByTestId('focus-task').evaluate((el) => el.blur());
await focusPage.waitForTimeout(80);
await focusPage.keyboard.press(' ');
if ((await focusPage.getByTestId('focus-countdown').count()) !== 0) {
  fail('space: should focus the task, not start a block');
}
const focusedSpace = await focusPage.getByTestId('focus-task').evaluate((el) => document.activeElement === el);
if (!focusedSpace) fail('space: task input should be focused');
await focusPage.close();

const orbPage = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await openLanding(orbPage, '/?intro=0');
const orbBox = await orbPage.getByTestId('orb-canvas').boundingBox();
if (!orbBox) fail('orb-click: canvas missing');
await orbPage.mouse.click(orbBox.x + orbBox.width / 2, orbBox.y + orbBox.height * 0.38);
const focusedOrb = await orbPage.getByTestId('focus-task').evaluate((el) => document.activeElement === el);
if (!focusedOrb) fail('orb-click: task input should be focused');
await orbPage.close();

const replay = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await openLanding(replay, '/?intro=0');
await replay.getByTestId('replay-intro').click();
await replay.getByTestId('focus-intro').waitFor({ timeout: 4000 });
if ((await replay.getByTestId('focus-intro-hint').textContent()) !== 'Skip (Esc)') {
  fail('replay: skip control should say Skip (Esc)');
}
await replay.getByTestId('focus-intro-hint').click();
await replay.getByTestId('focus-intro').waitFor({ state: 'detached', timeout: 4000 });
await replay.getByTestId('focus-task').waitFor();
await replay.close();

for (const [width, height, tag] of [
  [1280, 800, '1280'],
  [390, 844, '390'],
]) {
  const custom = await browser.newPage({
    viewport: { width, height },
    hasTouch: width === 390,
    isMobile: width === 390,
  });
  await openLanding(custom, '/?intro=0');
  await custom.getByTestId('focus-task').fill('Write the spec');
  await custom.getByTestId('duration-custom').click();
  await custom.getByTestId('custom-minutes').waitFor();
  await publish(custom, `custom_duration_after_${tag}.png`);
  await custom.getByTestId('custom-minutes').fill('40');
  await custom.getByTestId('focus-start').click();
  await custom.getByTestId('focus-countdown').waitFor({ timeout: 4000 });
  const countdown = await custom.getByTestId('focus-countdown').textContent();
  if (!countdown || !countdown.includes('40m')) {
    fail(`custom ${tag}: should start a 40m block, got ${countdown}`);
  }
  await custom.close();
}

const endPage = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await seedFirstOpen(endPage);
await endPage.goto(`${BASE}/?intro=0&settle=0&prompt=done&done=1&planned=50&task=Write%20the%20spec`, {
  waitUntil: 'domcontentloaded',
});
await endPage.getByTestId('focused-today').waitFor({ timeout: 8000 });
await endPage.getByTestId('focus-completed').waitFor({ timeout: 8000 });
const today = await endPage.getByTestId('focused-today').textContent();
const recap = await endPage.getByTestId('focus-completed').textContent();
if (today !== '1m focused today.') fail(`end: today should be 1m focused today., got ${today}`);
if (recap !== 'Focused 1 of 50 min on Write the spec') {
  fail(`end: recap should agree, got ${recap}`);
}
if ((await endPage.getByTestId('take-break').textContent()) !== 'Take a break') {
  fail('end: Take a break should be visible');
}
const anotherClass = await endPage.getByTestId('another-round').locator('span').getAttribute('class');
if (anotherClass && anotherClass.includes('rounded-full')) {
  fail('end: Start another should not be a pill');
}
await publish(endPage, 'reflection_after_1280.png');
await endPage.close();

const endMobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
await seedFirstOpen(endMobile);
await endMobile.goto(`${BASE}/?intro=0&settle=0&prompt=done&done=1&planned=50&task=Write%20the%20spec`, {
  waitUntil: 'domcontentloaded',
});
await endMobile.getByTestId('focus-completed').waitFor({ timeout: 8000 });
await publish(endMobile, 'reflection_after_390.png');
await endMobile.close();

for (const [width, height, tag] of [
  [1280, 800, '1280'],
  [390, 844, '390'],
]) {
  const settings = await browser.newPage({ viewport: { width, height } });
  await seedFirstOpen(settings);
  await settings.goto(`${BASE}/?intro=0&settings=1`, { waitUntil: 'domcontentloaded' });
  await settings.getByTestId('settings-sheet').waitFor();
  if ((await settings.getByTestId('play-intro').count()) !== 0) fail(`settings ${tag}: Play intro should be gone`);
  if ((await settings.getByTestId('intro-sound').count()) !== 1) fail(`settings ${tag}: Intro sound should stay`);
  await settings.getByTestId('default-duration-custom').click();
  await settings.getByTestId('default-custom-minutes').waitFor();
  await publish(settings, `settings_after_${tag}.png`);
  await settings.close();
}

const guest = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await openLanding(guest, '/?intro=0');
await guest.getByTestId('focus-task').fill('One thing');
await guest.getByTestId('focus-start').click();
await guest.getByTestId('focus-countdown').waitFor({ timeout: 4000 });
await guest.keyboard.press(' ');
await guest.getByTestId('end-focus').waitFor({ timeout: 4000 });
await guest.getByTestId('end-focus').click();
await guest.getByTestId('focus-completed').waitFor({ timeout: 8000 });
const guestToday = await guest.getByTestId('focused-today').textContent();
const guestRecap = await guest.getByTestId('focus-completed').textContent();
if (!guestToday || !guestToday.includes('focused today')) {
  fail(`guest complete: missing today line, got ${guestToday}`);
}
if (!guestRecap || !guestRecap.includes('Focused') || !guestRecap.includes('One thing')) {
  fail(`guest complete: missing recap, got ${guestRecap}`);
}
const todayMins = guestToday.match(/(\d+)m/)?.[1];
const recapMins = guestRecap.match(/Focused (\d+)/)?.[1];
if (todayMins && recapMins && todayMins !== recapMins) {
  fail(`guest complete: today ${guestToday} disagrees with recap ${guestRecap}`);
}
await guest.close();

await browser.close();
if (process.exitCode) {
  console.error('start-focusing e2e failed');
  process.exit(process.exitCode);
}
console.log('start-focusing e2e passed');
console.log(`shots ${OUT}`);
