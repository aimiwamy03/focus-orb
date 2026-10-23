import { chromium } from 'playwright';
import { copyFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const BASE = process.env.MENU_BASE || 'http://localhost:3000';
const OUT = process.env.DURATION_SHOTS || '/opt/cursor/artifacts/duration-click';
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

async function seed(page) {
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.setItem('focusOrb:introPlayed', '1');
    sessionStorage.setItem('focusOrb:settlePlayed', '1');
    localStorage.setItem('focusOrb:shortcutsCard', '1');
    localStorage.setItem(
      'focusOrb:hints',
      JSON.stringify({
        click: true,
        hover: true,
        fullscreen: true,
        chrome: true,
        'leave-tab': true,
      })
    );
  });
}

async function open(page, search = '/?mock=empty&intro=0&settle=0') {
  await seed(page);
  await page.goto(`${BASE}${search}`, { waitUntil: 'domcontentloaded' });
  await page.getByTestId('duration-chips').waitFor({ timeout: 15_000 });
  await page.waitForTimeout(400);
}

async function chipClass(page, minutes) {
  return page.getByTestId(`duration-${minutes}m`).locator('span').getAttribute('class');
}

async function assertSelected(page, minutes, label) {
  const highlighted = await page.getByTestId(`duration-${minutes}m`).getAttribute('data-highlighted');
  if (highlighted !== 'true') {
    fail(`${label}: ${minutes}m should be selected after click`);
  }
  const cls = await chipClass(page, minutes);
  if (!cls || cls.includes('rounded-full') || cls.includes('bg-orb-highlight') || cls.includes('ring-2')) {
    fail(`${label}: ${minutes}m should not be a pill, got ${cls}`);
  }
  if (!cls.includes('underline')) {
    fail(`${label}: ${minutes}m should use an underline, got ${cls}`);
  }
  const size = await page.getByTestId(`duration-${minutes}m`).evaluate((el) => {
    const style = getComputedStyle(el.querySelector('span') ?? el);
    return { font: parseFloat(style.fontSize), color: style.color };
  });
  if (size.font < 17) fail(`${label}: ${minutes}m font should be 17px+, got ${size.font}`);
}

async function clickEach(page, label) {
  for (const minutes of [25, 50, 90]) {
    await page.getByTestId(`duration-${minutes}m`).click();
    await page.waitForTimeout(120);
    if ((await page.getByTestId('focus-task-name').count()) !== 0) {
      fail(`${label}: clicking ${minutes}m started a session`);
    }
    await assertSelected(page, minutes, label);
    await publish(page, `duration_click_${label}_${minutes}m.png`);
  }
}

const browser = await chromium.launch({ args: ['--use-gl=angle'] });

const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await open(desktop);
await clickEach(desktop, '1440');
await desktop.keyboard.press('ArrowLeft');
await desktop.waitForTimeout(120);
await assertSelected(desktop, 50, '1440-arrows');
await desktop.close();

const mobile = await browser.newContext({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
});
const phone = await mobile.newPage();
await open(phone);
for (const minutes of [25, 50, 90]) {
  await phone.getByTestId(`duration-${minutes}m`).tap();
  await phone.waitForTimeout(120);
  if ((await phone.getByTestId('focus-task-name').count()) !== 0) {
    fail(`390-touch: tapping ${minutes}m started a session`);
  }
  await assertSelected(phone, minutes, '390-touch');
  await publish(phone, `duration_click_390_${minutes}m.png`);
}
await phone.close();
await mobile.close();
await browser.close();

if (process.exitCode) {
  console.error('duration-click e2e failed');
  process.exit(process.exitCode);
}
console.log('duration-click e2e passed');
