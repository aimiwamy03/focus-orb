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

async function openHandoff(page, search = '/?intro=0') {
  await seedFirstOpen(page);
  await page.goto(`${BASE}${search}`, { waitUntil: 'domcontentloaded' });
  if (search.includes('intro=1') && !search.includes('t=')) {
    await page.getByTestId('focus-intro').waitFor();
    await page.keyboard.press('Escape');
    await page.getByTestId('focus-intro').waitFor({ state: 'detached', timeout: 4000 });
  }
  await page.getByTestId('start-focusing').waitFor({ timeout: 8000 });
}

async function assertHandoff(page, label) {
  const start = page.getByTestId('start-focusing');
  if ((await start.count()) !== 1) fail(`${label}: Start focusing should be visible`);
  const metrics = await start.evaluate((el) => {
    const style = getComputedStyle(el);
    const secondary = document.querySelector('[data-testid="welcome-secondary"]');
    const secondStyle = secondary ? getComputedStyle(secondary) : null;
    return {
      text: el.textContent,
      font: parseFloat(style.fontSize),
      color: style.color,
      radius: style.borderRadius,
      bg: style.backgroundColor,
      className: el.className,
      secondFont: secondStyle ? parseFloat(secondStyle.fontSize) : 0,
    };
  });
  if (metrics.text !== 'Start focusing') fail(`${label}: missing Start focusing label`);
  if (metrics.font < 22) fail(`${label}: Start focusing should be 22px+, got ${metrics.font}`);
  if (metrics.secondFont < 17) fail(`${label}: secondary links should be 17px+, got ${metrics.secondFont}`);
  if (metrics.font <= metrics.secondFont) {
    fail(`${label}: Start focusing (${metrics.font}) should outrank secondary (${metrics.secondFont})`);
  }
  if (metrics.className.includes('rounded-full') || metrics.radius !== '0px') {
    fail(`${label}: Start focusing should not be a pill, radius ${metrics.radius}`);
  }
  if (metrics.bg !== 'rgba(0, 0, 0, 0)' && metrics.bg !== 'transparent') {
    fail(`${label}: Start focusing should not have a filled background, got ${metrics.bg}`);
  }
  if ((await page.getByTestId('sample-day').count()) !== 1) {
    fail(`${label}: Sample day should stay as a secondary action`);
  }
  if ((await page.getByTestId('welcome-about').count()) !== 1) {
    fail(`${label}: About should stay secondary`);
  }
}

async function assertAsk(page, label) {
  await page.getByTestId('focus-task').waitFor({ timeout: 4000 });
  if ((await page.locator("text=What's the one thing?").count()) !== 1) {
    fail(`${label}: should land on What's the one thing?`);
  }
  const focused = await page.getByTestId('focus-task').evaluate((el) => document.activeElement === el);
  if (!focused) fail(`${label}: task input should be focused`);
  for (const minutes of [25, 50, 90]) {
    if ((await page.getByTestId(`duration-${minutes}m`).count()) !== 1) {
      fail(`${label}: ${minutes}m should be ready`);
    }
  }
  if ((await page.getByTestId('start-focusing').count()) !== 0) {
    fail(`${label}: Start focusing should be gone after the handoff`);
  }
}

const browser = await chromium.launch({ args: ['--use-gl=angle'] });

for (const [width, height, tag] of [
  [1440, 900, '1440'],
  [390, 844, '390'],
]) {
  const page = await browser.newPage({
    viewport: { width, height },
    hasTouch: width === 390,
    isMobile: width === 390,
  });
  await openHandoff(page, '/?intro=1');
  await assertHandoff(page, tag);
  await publish(page, `handoff_after_${tag}.png`);
  if (width === 390) await page.getByTestId('start-focusing').tap();
  else await page.getByTestId('start-focusing').click();
  await assertAsk(page, `${tag}-click`);
  await publish(page, `ask_after_start_${tag}.png`);
  await page.close();
}

const enterPage = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await openHandoff(enterPage, '/?intro=0');
await enterPage.keyboard.press('Enter');
await assertAsk(enterPage, 'enter');
await enterPage.close();

const orbPage = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await openHandoff(orbPage, '/?intro=0');
const orbBox = await orbPage.getByTestId('orb-canvas').boundingBox();
if (!orbBox) fail('orb-click: canvas missing');
await orbPage.mouse.click(orbBox.x + orbBox.width / 2, orbBox.y + orbBox.height * 0.38);
await assertAsk(orbPage, 'orb-click');
await orbPage.close();

for (const [width, height, tag] of [
  [1440, 900, '1440'],
  [390, 844, '390'],
]) {
  const card = await browser.newPage({ viewport: { width, height } });
  await seedFirstOpen(card);
  await card.goto(`${BASE}/?intro=1&t=1.8`, { waitUntil: 'domcontentloaded' });
  await card.getByTestId('focus-intro-caption').waitFor();
  const tracking = await card.getByTestId('focus-intro-caption').evaluate((el) => {
    const style = getComputedStyle(el);
    const box = el.getBoundingClientRect();
    return {
      letterSpacing: style.letterSpacing,
      fontSize: parseFloat(style.fontSize),
      wraps: box.height > parseFloat(style.fontSize) * 1.8,
      overflow: box.right > window.innerWidth + 2,
      text: el.textContent,
    };
  });
  const px = parseFloat(tracking.letterSpacing);
  const em = px / tracking.fontSize;
  if (em < 0.015 || em > 0.07) {
    fail(`Title-card tracking at ${tag} should be ~0.02-0.06em, got ${em}em (${tracking.letterSpacing})`);
  }
  if (tag === '1440' && tracking.wraps) fail('1440 title card should stay on one line');
  if (tracking.overflow) fail(`${tag} title card overflowed the viewport`);
  await publish(card, `title_card_${tag}.png`);
  await card.close();
}

await browser.close();
if (process.exitCode) {
  console.error('start-focusing e2e failed');
  process.exit(process.exitCode);
}
console.log('start-focusing e2e passed');
console.log(`shots ${OUT}`);
