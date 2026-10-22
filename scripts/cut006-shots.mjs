import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const BASE = process.env.LAYOUT_BASE_URL || 'http://localhost:3000';
const OUT = ['/opt/cursor/artifacts/cut006', path.resolve('artifacts/cut006')];
const VIEWPORTS = [
  { name: '1280x640', width: 1280, height: 640 },
  { name: '1440x900', width: 1440, height: 900 },
];

const SEEN = {
  'focusOrb:shortcutsCard': '1',
  'focusOrb:hints': JSON.stringify({ hover: true, chrome: true, 'leave-tab': true }),
};

async function shot(page, name) {
  for (const dir of OUT) {
    await mkdir(dir, { recursive: true });
    await page.screenshot({ path: path.join(dir, `${name}.png`), fullPage: false });
  }
}

async function open(page, search, storage = SEEN) {
  await page.addInitScript((seed) => {
    localStorage.clear();
    for (const [key, value] of Object.entries(seed)) localStorage.setItem(key, value);
  }, storage);
  await page.goto(`${BASE}${search}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
}

async function walk(page, vp) {
  const p = (id) => `cut006_${vp}_${id}`;

  await open(page, '/', {});
  await shot(page, p('01_first_open'));

  await open(page, '/?mock=back-to-back');
  await shot(page, p('02_sample_day'));

  await open(page, '/?mock=open-afternoon');
  await shot(page, p('03_ask'));

  await open(
    page,
    '/?mock=open-afternoon&prompt=focus&focus=50&task=Write%20the%20spec'
  );
  await page.mouse.move(20, 20);
  await page.waitForTimeout(200);
  await shot(page, p('04_focusing'));

  await open(page, '/?mock=pre-meeting&now=13:26');
  await shot(page, p('05_meeting_soon'));

  await open(page, '/?mock=in-meeting&now=13:45');
  await shot(page, p('06_in_meeting'));

  await open(
    page,
    '/?mock=open-afternoon&prompt=stop&focus=50&task=Write%20the%20spec'
  );
  const end = page.getByTestId('end-focus');
  if (await end.count()) await end.click();
  await page.waitForTimeout(400);
  await shot(page, p('07_ended_early'));

  await open(
    page,
    '/?mock=open-afternoon&prompt=done&done=50&task=Write%20the%20spec'
  );
  await shot(page, p('08_completed'));

  await open(page, '/?mock=open-afternoon&prompt=break');
  await shot(page, p('09_break'));

  await open(page, '/?mock=open-afternoon&settings=1');
  await shot(page, p('10_settings'));

  await open(page, '/?mock=open-afternoon&minionly=1&unsupported=1');
  await shot(page, p('11_mini_only'));
}

const browser = await chromium.launch({ args: ['--use-gl=angle'] });
for (const vp of VIEWPORTS) {
  const page = await browser.newPage({
    viewport: { width: vp.width, height: vp.height },
  });
  await walk(page, vp.name);
  await page.close();
}
await browser.close();
console.log('cut006 shots written');
