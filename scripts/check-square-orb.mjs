import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const BASE = process.env.LAYOUT_BASE_URL || 'http://localhost:3000';
const OUT_DIRS = [
  path.resolve('artifacts'),
  '/opt/cursor/artifacts',
];
const ASK_PATH = '/?mock=open-afternoon&now=13:00';
const MINI_PATH =
  '/?mini=1&mock=open-afternoon&now=13:00&prompt=focus&focus=50&task=Deep%20work';

async function shot(page, name, locator) {
  const file = `${name}.png`;
  for (const dir of OUT_DIRS) {
    await mkdir(dir, { recursive: true });
    const target = locator ?? page;
    await target.screenshot({ path: path.join(dir, file), fullPage: false });
  }
  return file;
}

async function waitForPaintedOrb(page) {
  await page.waitForFunction(() => {
    const canvas = document.querySelector('[data-testid="orb-canvas"]');
    return canvas instanceof HTMLCanvasElement && canvas.width > 300 && canvas.clientWidth > 300;
  });
  await page.waitForTimeout(800);
}

async function measureMain(page) {
  return page.evaluate(() => {
    const canvas = document.querySelector('[data-testid="orb-canvas"]');
    const stack = document.querySelector('[data-testid="bottom-stack"]');
    const prompt = document.querySelector('[data-testid="focus-prompt"]');
    const chips = document.querySelector('[data-testid="duration-chips"]');
    const start = document.querySelector('[data-testid="focus-start"]');
    const restore = document.querySelector('[data-testid="floating-restore"]');
    if (!(canvas instanceof HTMLCanvasElement)) throw new Error('orb canvas missing');
    const css = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    return {
      inner: { w: window.innerWidth, h: window.innerHeight },
      canvasAttr: { w: canvas.width, h: canvas.height },
      canvasCss: { w: css.width, h: css.height },
      dpr,
      stack: Boolean(stack),
      prompt: Boolean(prompt),
      chips: Boolean(chips),
      start: Boolean(start),
      restore: Boolean(restore),
      stackH: stack?.getBoundingClientRect().height ?? 0,
    };
  });
}

function assertMainChrome(info, viewport, label) {
  if (Math.abs(info.canvasCss.w - viewport.width) > 2) {
    throw new Error(`${label}: canvas CSS width ${info.canvasCss.w} != ${viewport.width}`);
  }
  if (Math.abs(info.canvasCss.h - viewport.height) > 2) {
    throw new Error(`${label}: canvas CSS height ${info.canvasCss.h} != ${viewport.height}`);
  }
  if (Math.abs(info.canvasAttr.w - Math.round(info.canvasCss.w * info.dpr)) > 1) {
    throw new Error(
      `${label}: backing width ${info.canvasAttr.w} != CSS ${info.canvasCss.w} * dpr ${info.dpr}`
    );
  }
  if (Math.abs(info.canvasAttr.h - Math.round(info.canvasCss.h * info.dpr)) > 1) {
    throw new Error(
      `${label}: backing height ${info.canvasAttr.h} != CSS ${info.canvasCss.h} * dpr ${info.dpr}`
    );
  }
  if (!info.stack || !info.prompt || !info.chips || !info.start) {
    throw new Error(`${label}: bottom stack missing prompt/chips/start`);
  }
  if (info.restore) {
    throw new Error(`${label}: mini-only restore is still up`);
  }
  if (info.stackH < 40) {
    throw new Error(`${label}: bottom stack height ${info.stackH} is collapsed`);
  }
}

async function open(browser, viewport, search, dpr = 2) {
  const page = await browser.newPage({
    viewport,
    deviceScaleFactor: dpr,
  });
  await page.addInitScript(() => {
    try {
      localStorage.clear();
    } catch {}
  });
  await page.goto(`${BASE}${search}`, { waitUntil: 'domcontentloaded' });
  await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });
  return page;
}

const shots = [];
const browser = await chromium.launch({ args: ['--no-sandbox'] });
try {
  const square = { width: 1024, height: 920 };
  const squarePage = await open(browser, square, ASK_PATH);
  await squarePage.waitForSelector('[data-testid="bottom-stack"]');
  await squarePage.waitForSelector('[data-testid="focus-start"]');
  await waitForPaintedOrb(squarePage);
  assertMainChrome(await measureMain(squarePage), square, '1024x920');
  shots.push(await shot(squarePage, 'square_orb_1024x920'));
  await squarePage.close();

  const tall = { width: 900, height: 1200 };
  const tallPage = await open(browser, tall, ASK_PATH);
  await tallPage.waitForSelector('[data-testid="focus-start"]');
  await waitForPaintedOrb(tallPage);
  assertMainChrome(await measureMain(tallPage), tall, '900x1200');
  shots.push(await shot(tallPage, 'square_orb_900x1200'));
  await tallPage.close();

  const resizedPage = await open(browser, { width: 1280, height: 640 }, ASK_PATH);
  await resizedPage.waitForSelector('[data-testid="focus-start"]');
  await waitForPaintedOrb(resizedPage);
  await resizedPage.setViewportSize({ width: 1024, height: 920 });
  await resizedPage.waitForTimeout(250);
  await waitForPaintedOrb(resizedPage);
  assertMainChrome(await measureMain(resizedPage), square, 'resized 1280x640 -> 1024x920');
  shots.push(await shot(resizedPage, 'square_orb_resized_1024x920'));
  await resizedPage.close();

  const miniPage = await open(browser, { width: 1280, height: 800 }, MINI_PATH);
  const preview = miniPage.locator('[data-testid="mini-preview"]');
  await preview.waitFor({ state: 'visible' });
  await preview.evaluate((el) => {
    el.style.width = '600px';
    el.style.height = '600px';
  });
  await miniPage.waitForTimeout(250);
  const mini = await miniPage.evaluate(() => {
    const canvas = document.querySelector('[data-testid="mini-orb-canvas"]');
    const status = document.querySelector('[data-testid="mini-status"]');
    const orb = document.querySelector('[data-testid="mini-orb"]');
    if (
      !(canvas instanceof HTMLCanvasElement) ||
      !(status instanceof HTMLElement) ||
      !(orb instanceof HTMLElement)
    ) {
      throw new Error('mini markup missing');
    }
    const css = canvas.getBoundingClientRect();
    const statusBox = status.getBoundingClientRect();
    const orbBox = orb.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    return {
      orb: { w: orbBox.width, h: orbBox.height },
      canvasAttr: { w: canvas.width, h: canvas.height },
      canvasCss: { w: css.width, h: css.height },
      dpr,
      status: {
        text: status.textContent,
        h: statusBox.height,
        visible: statusBox.height > 0 && statusBox.bottom <= orbBox.bottom + 1,
      },
    };
  });
  if (Math.abs(mini.orb.w - 600) > 1.5 || Math.abs(mini.orb.h - 600) > 1.5) {
    throw new Error(`mini orb is ${mini.orb.w}x${mini.orb.h}, expected 600x600`);
  }
  if (Math.abs(mini.canvasAttr.w - Math.round(mini.canvasCss.w * mini.dpr)) > 1) {
    throw new Error(
      `large PiP backing ${mini.canvasAttr.w} != CSS ${mini.canvasCss.w} * dpr ${mini.dpr}`
    );
  }
  if (Math.abs(mini.canvasAttr.h - Math.round(mini.canvasCss.h * mini.dpr)) > 1) {
    throw new Error(
      `large PiP backing height ${mini.canvasAttr.h} != CSS ${mini.canvasCss.h} * dpr ${mini.dpr}`
    );
  }
  if (mini.canvasCss.h > 580) {
    throw new Error(`large PiP canvas CSS height ${mini.canvasCss.h} ate the status line`);
  }
  if (!mini.status.visible || !mini.status.text) {
    throw new Error('large PiP status line is missing');
  }
  shots.push(await shot(miniPage, 'square_orb_pip_600x600', preview));
  await miniPage.close();

  const restorePage = await open(browser, square, `${ASK_PATH}&minionly=1`);
  await restorePage.waitForSelector('[data-testid="floating-restore"]');
  await restorePage.locator('[data-testid="floating-restore"]').click();
  await restorePage.waitForSelector('[data-testid="bottom-stack"]');
  await restorePage.waitForSelector('[data-testid="focus-start"]');
  assertMainChrome(await measureMain(restorePage), square, 'after mini-only restore');
  await restorePage.close();

  console.log(JSON.stringify({ ok: true, shots }, null, 2));
} finally {
  await browser.close();
}
