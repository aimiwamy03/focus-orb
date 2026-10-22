import { chromium, webkit } from 'playwright';
import { copyFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const BASE = process.env.MENU_BASE || 'http://localhost:3000';
const OUT = process.env.CARET_SHOTS || '/opt/cursor/artifacts/caret';
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

async function measureEmpty(page) {
  return page.evaluate(() => {
    const heading = document.querySelector('[data-testid="ask-heading"]');
    const input = document.querySelector('[data-testid="focus-task"]');
    const placeholder = document.querySelector('[data-testid="focus-task-placeholder"]');
    const field = document.querySelector('[data-testid="ask-task-field"]');
    if (
      !(heading instanceof HTMLElement) ||
      !(input instanceof HTMLInputElement) ||
      !(placeholder instanceof HTMLElement) ||
      !(field instanceof HTMLElement)
    ) {
      return { ok: false, reason: 'missing field' };
    }
    input.focus();
    const cs = getComputedStyle(input);
    const headingBox = heading.getBoundingClientRect();
    const placeholderBox = placeholder.getBoundingClientRect();
    const fieldBox = field.getBoundingClientRect();
    const caretX =
      input.getBoundingClientRect().left +
      parseFloat(cs.paddingLeft) +
      parseFloat(cs.borderLeftWidth);
    const headingCx = headingBox.left + headingBox.width / 2;
    const placeholderCx = placeholderBox.left + placeholderBox.width / 2;
    const fieldCx = fieldBox.left + fieldBox.width / 2;
    return {
      ok: true,
      caretX,
      placeholderLeft: placeholderBox.left,
      caretDiff: Math.abs(caretX - placeholderBox.left),
      headingCx,
      placeholderCx,
      fieldCx,
      centerDiff: Math.abs(placeholderCx - headingCx),
      fieldCenterDiff: Math.abs(fieldCx - headingCx),
      align: cs.textAlign,
      value: input.value,
      placeholder: placeholder.textContent,
      inputWidth: input.getBoundingClientRect().width,
      placeholderWidth: placeholderBox.width,
    };
  });
}

async function measureTyped(page) {
  return page.evaluate(() => {
    const heading = document.querySelector('[data-testid="ask-heading"]');
    const input = document.querySelector('[data-testid="focus-task"]');
    const field = document.querySelector('[data-testid="ask-task-field"]');
    if (
      !(heading instanceof HTMLElement) ||
      !(input instanceof HTMLInputElement) ||
      !(field instanceof HTMLElement)
    ) {
      return { ok: false, reason: 'missing typed field' };
    }
    const headingBox = heading.getBoundingClientRect();
    const inputBox = input.getBoundingClientRect();
    const fieldBox = field.getBoundingClientRect();
    const headingCx = headingBox.left + headingBox.width / 2;
    const textCx = inputBox.left + inputBox.width / 2;
    const fieldCx = fieldBox.left + fieldBox.width / 2;
    return {
      ok: true,
      headingCx,
      textCx,
      fieldCx,
      centerDiff: Math.abs(textCx - headingCx),
      fieldCenterDiff: Math.abs(fieldCx - headingCx),
      align: getComputedStyle(input).textAlign,
      value: input.value,
      inputWidth: inputBox.width,
    };
  });
}

async function runIn(browserType, name, viewport) {
  const browser = await browserType.launch(
    browserType === chromium ? { args: ['--use-gl=angle'] } : {}
  );
  const page = await browser.newPage({ viewport });
  await seed(page);
  await page.goto(`${BASE}/?mock=empty`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-testid="focus-task"]');
  await page.waitForTimeout(400);
  await page.getByTestId('focus-task').click();
  const empty = await measureEmpty(page);
  if (!empty.ok) fail(`${name} ${viewport.width} empty field missing: ${empty.reason}`);
  if (empty.align !== 'start' && empty.align !== 'left') {
    fail(`${name} empty input should be start-aligned, got ${empty.align}`);
  }
  if (empty.placeholder !== 'Focus') {
    fail(`${name} placeholder should be Focus, got ${empty.placeholder}`);
  }
  if (empty.caretDiff > 2) {
    fail(
      `${name} empty caret x ${empty.caretX} should match placeholder left ${empty.placeholderLeft} within 2px (diff ${empty.caretDiff})`
    );
  }
  if (empty.centerDiff > 3) {
    fail(
      `${name} empty placeholder center ${empty.placeholderCx} should match heading center ${empty.headingCx} within 3px (diff ${empty.centerDiff})`
    );
  }
  const tag = `${name}_${viewport.width}`;
  await publish(page, `ask_caret_empty_${tag}.png`);

  await page.getByTestId('focus-task').fill('write the spec');
  await page.waitForTimeout(150);
  if ((await page.getByTestId('focus-task-placeholder').count()) !== 0) {
    fail(`${name} typed field should hide the Focus placeholder`);
  }
  const typed = await measureTyped(page);
  if (!typed.ok) fail(`${name} typed field missing: ${typed.reason}`);
  if (typed.align !== 'start' && typed.align !== 'left') {
    fail(`${name} typed input should stay start-aligned in a centered field, got ${typed.align}`);
  }
  if (typed.centerDiff > 3) {
    fail(
      `${name} typed text center ${typed.textCx} should match heading center ${typed.headingCx} within 3px (diff ${typed.centerDiff})`
    );
  }
  await publish(page, `ask_caret_typed_${tag}.png`);
  await page.close();
  await browser.close();
}

const viewports = [
  { width: 1024, height: 800 },
  { width: 1280, height: 800 },
];

for (const viewport of viewports) {
  await runIn(chromium, 'chromium', viewport);
  try {
    await runIn(webkit, 'webkit', viewport);
  } catch (error) {
    fail(`WebKit caret check failed: ${error instanceof Error ? error.message : error}`);
  }
}

if (process.exitCode) {
  console.error('e2e caret failed');
  process.exit(process.exitCode);
}
console.log('e2e caret passed');
console.log(`shots ${OUT}`);
