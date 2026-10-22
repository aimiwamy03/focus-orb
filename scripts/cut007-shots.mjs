import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const phase = process.argv[2] === 'before' ? 'before' : 'after';
const BASE = process.env.LAYOUT_BASE_URL || 'http://localhost:3000';
const OUT = ['/opt/cursor/artifacts/cut007', path.resolve('artifacts/cut007')];

const ASK_VIEWS = [
  { name: '1280x640', width: 1280, height: 640 },
  { name: '1440x900', width: 1440, height: 900 },
  { name: '1024x768', width: 1024, height: 768 },
  { name: '686x386', width: 686, height: 386 },
];

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
  'focusOrb:lastTask': 'Focus',
};

async function shot(page, name) {
  for (const dir of OUT) {
    await mkdir(dir, { recursive: true });
    await page.screenshot({
      path: path.join(dir, `${phase}_${name}.png`),
      fullPage: false,
    });
  }
}

async function open(page, search) {
  await page.addInitScript((seed) => {
    localStorage.clear();
    for (const [key, value] of Object.entries(seed)) localStorage.setItem(key, value);
  }, SEED);
  await page.goto(`${BASE}${search}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
}

const browser = await chromium.launch({ args: ['--use-gl=angle'] });

for (const vp of ASK_VIEWS) {
  const page = await browser.newPage({
    viewport: { width: vp.width, height: vp.height },
  });
  await open(page, '/?mock=empty');
  await shot(page, `ask_${vp.name}`);
  await page.close();
}

if (phase === 'after') {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await open(
    page,
    '/?mock=empty&prompt=focus&focus=50&task=Write%20the%20spec'
  );
  await shot(page, 'focusing_1280x800');

  await open(
    page,
    '/?mock=empty&prompt=done&done=50&task=Write%20the%20spec'
  );
  await shot(page, 'completed_1280x800');

  await open(page, '/?mock=empty&settings=1');
  await shot(page, 'settings_1280x800');
  await page.close();
}

await browser.close();
console.log(`cut007 ${phase} shots written`);
