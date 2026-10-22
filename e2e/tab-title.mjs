import { chromium } from 'playwright';

const BASE = process.env.MENU_BASE || 'http://localhost:3000';
const APP_TITLE = 'Focus Orb';

function fail(message) {
  console.error(`FAIL ${message}`);
  process.exitCode = 1;
}

const HINTS = JSON.stringify({
  click: true,
  hover: true,
  fullscreen: true,
  chrome: true,
  'leave-tab': true,
});

async function open(browser, search) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.addInitScript((hints) => {
    localStorage.clear();
    sessionStorage.setItem('focusOrb:introPlayed', '1');
    localStorage.setItem('focusOrb:shortcutsCard', '1');
    localStorage.setItem('focusOrb:hints', hints);
  }, HINTS);
  await page.goto(`${BASE}${search}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  return page;
}

async function assertTitle(page, label) {
  const title = await page.title();
  if (title !== APP_TITLE) {
    fail(`${label}: title is ${JSON.stringify(title)}, want ${JSON.stringify(APP_TITLE)}`);
  }
}

const browser = await chromium.launch({ args: ['--use-gl=angle'] });

const idle = await open(browser, '/?mock=empty');
await assertTitle(idle, 'idle');
await idle.close();

const focusing = await open(
  browser,
  '/?mock=empty&prompt=focus&focus=50&task=Deep%20work'
);
await assertTitle(focusing, 'focusing');
await focusing.close();

const brk = await open(browser, '/?mock=empty&prompt=break');
await assertTitle(brk, 'break');
await brk.close();

const soon = await open(browser, '/?mock=pre-meeting&now=13:25');
await assertTitle(soon, 'before meetings');
await soon.close();

const sample = await open(browser, '/?mock=back-to-back');
await assertTitle(sample, 'sample-day');
await sample.close();

const logPage = await open(browser, '/?mock=empty&hover=1');
const logButton = logPage.getByTestId('focus-log-open');
if ((await logButton.count()) === 1) {
  await logButton.click();
} else {
  await logPage.keyboard.press('l');
}
await logPage.waitForTimeout(300);
await assertTitle(logPage, 'focus log');
await logPage.close();

const privacy = await open(browser, '/privacy');
await assertTitle(privacy, 'privacy');
await privacy.close();

await browser.close();

if (process.exitCode) {
  console.error('e2e tab-title failed');
  process.exit(process.exitCode);
}
console.log('e2e tab-title passed');
