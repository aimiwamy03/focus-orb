import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const BASE = process.env.LAYOUT_BASE_URL || 'http://localhost:3000';
const OUT_DIRS = [
  path.resolve('artifacts'),
  '/opt/cursor/artifacts',
];

const ASK_PATH = '/?mock=open-afternoon&now=13:00';
const FOCUS_PATH = '/?mock=open-afternoon&now=13:00&prompt=focus&focus=32.9&task=Deep%20work';

function overlap(a, b, slop = 0.5) {
  return (
    a.left < b.right - slop &&
    a.right > b.left + slop &&
    a.top < b.bottom - slop &&
    a.bottom > b.top + slop
  );
}

async function boxes(page, selectors) {
  const found = [];
  for (const selector of selectors) {
    const loc = page.locator(selector).first();
    if ((await loc.count()) === 0) continue;
    if (!(await loc.isVisible())) continue;
    found.push({ selector, box: await loc.boundingBox() });
  }
  return found.filter((item) => item.box);
}

async function waitForPaintedOrb(page) {
  await page.waitForFunction(() => {
    const canvas = document.querySelector('[data-testid="orb-canvas"]');
    if (!(canvas instanceof HTMLCanvasElement) || canvas.width < 8) return false;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return false;
    const w = Math.min(canvas.width, 400);
    const h = Math.min(canvas.height, 400);
    const x = Math.max(0, Math.floor(canvas.width / 2 - w / 2));
    const y = Math.max(0, Math.floor(canvas.height * 0.15));
    const { data } = ctx.getImageData(x, y, w, Math.min(h, canvas.height - y));
    for (let i = 0; i < data.length; i += 16) {
      if (data[i] > 40 || data[i + 1] > 40 || data[i + 2] > 40) return true;
    }
    return false;
  }, { timeout: 20000 });
}

async function assertNoOverlap(page, viewport) {
  const stack = page.locator('[data-testid="bottom-stack"]');
  await stack.waitFor({ state: 'visible' });

  const children = stack.locator(':scope > *');
  const count = await children.count();
  const rects = [];
  for (let i = 0; i < count; i++) {
    const box = await children.nth(i).boundingBox();
    if (box) rects.push({ i, ...box, right: box.x + box.width, bottom: box.y + box.height, left: box.x, top: box.y });
  }
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      if (overlap(rects[i], rects[j])) {
        throw new Error(`bottom-stack children ${i} and ${j} overlap at ${viewport.width}x${viewport.height}`);
      }
    }
  }

  const pairs = [
    ['[data-testid="focus-prompt"]', '[data-testid="timeline"]'],
    ['[data-testid="duration-chips"]', '[data-testid="timeline"]'],
    ['[data-testid="focus-start"]', '[data-testid="timeline"]'],
    ['[data-testid="status-line"]', '[data-testid="timeline"]'],
  ];
  for (const [leftSel, rightSel] of pairs) {
    const named = await boxes(page, [leftSel, rightSel]);
    if (named.length < 2) continue;
    const a = named[0].box;
    const b = named[1].box;
    const ra = { left: a.x, top: a.y, right: a.x + a.width, bottom: a.y + a.height };
    const rb = { left: b.x, top: b.y, right: b.x + b.width, bottom: b.y + b.height };
    if (overlap(ra, rb)) {
      throw new Error(`${leftSel} overlaps ${rightSel} at ${viewport.width}x${viewport.height}`);
    }
  }

  const start = page.locator('[data-testid="focus-start"]');
  if ((await start.count()) > 0 && (await start.isVisible())) {
    const box = await start.boundingBox();
    if (!box) throw new Error('Start button has no box');
    if (box.y + box.height > viewport.height + 0.5) {
      throw new Error(`Start button is clipped at ${viewport.width}x${viewport.height}`);
    }
    if (box.y < -0.5) {
      throw new Error(`Start button is above the viewport at ${viewport.width}x${viewport.height}`);
    }
  }

  await assertNoCornerPicker(page, viewport);

  const startVisible =
    (await start.count()) > 0 && (await start.isVisible());
  const timeline = page.locator('[data-testid="timeline"]');
  if (startVisible && (await timeline.count()) > 0 && (await timeline.isVisible())) {
    throw new Error(`timeline is still under Start at ${viewport.width}x${viewport.height}`);
  }

  const overflow = await page.evaluate(() => ({
    scrollHeight: document.documentElement.scrollHeight,
    innerHeight: window.innerHeight,
  }));
  if (overflow.scrollHeight > overflow.innerHeight + 1) {
    throw new Error(`page scrolls at ${viewport.width}x${viewport.height}: ${overflow.scrollHeight} > ${overflow.innerHeight}`);
  }
}

async function assertNoCornerPicker(page, viewport) {
  const forbidden = ['Start focus', '25 min', '50 min', '90 min', 'Focus until'];
  for (const text of forbidden) {
    const count = await page.getByText(text, { exact: true }).count();
    if (count > 0) {
      throw new Error(`corner picker text "${text}" rendered at ${viewport.width}x${viewport.height}`);
    }
  }
  if ((await page.locator('[data-testid="smart-focus"]').count()) > 0) {
    throw new Error(`smart-focus picker rendered at ${viewport.width}x${viewport.height}`);
  }
  if ((await page.locator('[data-testid="focus-control"]').count()) > 0) {
    throw new Error(`focus-control rendered at ${viewport.width}x${viewport.height}`);
  }
  const chips = page.locator('[data-testid="duration-chips"]');
  if ((await chips.count()) > 0 && (await chips.isVisible())) {
    const box = await chips.boundingBox();
    if (box && box.x + box.width / 2 > viewport.width * 0.7) {
      throw new Error(`duration chips are in the corner at ${viewport.width}x${viewport.height}`);
    }
  }
}

async function shot(page, name) {
  const file = `${name}.png`;
  for (const dir of OUT_DIRS) {
    await mkdir(dir, { recursive: true });
    await page.screenshot({ path: path.join(dir, file), fullPage: false });
  }
  return file;
}

async function open(browser, viewport, search) {
  const page = await browser.newPage({ viewport });
  await page.addInitScript(() => {
    try {
      localStorage.clear();
    } catch {}
  });
  await page.goto(`${BASE}${search}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid="bottom-stack"]');
  return page;
}

const STATES = [
  {
    name: 'ask',
    path: ASK_PATH,
    wait: '[data-testid="focus-start"]',
    shot: null,
  },
  {
    name: 'after-meeting',
    path: '/?mock=back-to-back&now=15:00',
    wait: '[data-testid="prompt-context"]',
    shot: 'layout_after_meeting_no_corner_1280x640',
  },
  {
    name: 'focusing',
    path: FOCUS_PATH,
    wait: '[data-testid="focus-countdown"]',
    shot: 'layout_focusing_no_corner_1280x640',
  },
  {
    name: 'stop',
    path: '/?mock=open-afternoon&now=13:00&prompt=stop&focus=32.9&task=Deep%20work',
    wait: '[data-testid="keep-going"]',
    shot: null,
  },
  {
    name: 'completed',
    path: '/?mock=open-afternoon&now=13:00&prompt=done&task=Deep%20work&done=50',
    wait: '[data-testid="focus-completed"]',
    shot: null,
  },
  {
    name: 'meeting-soon',
    path: '/?mock=pre-meeting&now=13:25',
    wait: '[data-testid="status-line"]',
    shot: null,
  },
  {
    name: 'in-meeting',
    path: '/?mock=in-meeting&now=13:45',
    wait: '[data-testid="status-line"]',
    shot: null,
  },
];

const shots = [];

const browser = await chromium.launch({ args: ['--no-sandbox'] });
try {
  const idleViewports = [
    { width: 1280, height: 640 },
    { width: 1280, height: 800 },
    { width: 1440, height: 900 },
  ];
  for (const viewport of idleViewports) {
    const page = await open(browser, viewport, ASK_PATH);
    await page.waitForSelector('[data-testid="focus-prompt"]');
    await page.waitForSelector('[data-testid="duration-chips"]');
    await page.waitForSelector('[data-testid="focus-start"]');
    await page.getByText(/Free until/).waitFor({ timeout: 15000 });
    await waitForPaintedOrb(page);
    await assertNoOverlap(page, viewport);
    shots.push(await shot(page, `layout_ask_no_corner_${viewport.width}x${viewport.height}`));
    await page.close();
  }

  const typedViewport = { width: 1280, height: 640 };
  const typed = await open(browser, typedViewport, ASK_PATH);
  await typed.waitForSelector('[data-testid="focus-task"]');
  await typed.getByText(/Free until/).waitFor({ timeout: 15000 });
  await typed.fill('[data-testid="focus-task"]', 'Write the spec');
  await waitForPaintedOrb(typed);
  await assertNoOverlap(typed, typedViewport);
  shots.push(await shot(typed, 'layout_typed_no_corner_1280x640'));
  await typed.close();

  const short = { width: 1280, height: 640 };
  for (const state of STATES) {
    const page = await open(browser, short, state.path);
    await page.waitForSelector(state.wait, { timeout: 15000 });
    await assertNoOverlap(page, short);
    if (state.shot) {
      await waitForPaintedOrb(page);
      shots.push(await shot(page, state.shot));
    }
    await page.close();
  }

  console.log(JSON.stringify({ ok: true, shots }, null, 2));
} finally {
  await browser.close();
}
