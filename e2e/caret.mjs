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

async function measureCaret(page) {
  return page.evaluate(() => {
    const input = document.querySelector('[data-testid="focus-task"]');
    const placeholder = document.querySelector('[data-testid="focus-task-placeholder"]');
    if (!(input instanceof HTMLInputElement) || !placeholder) {
      return { ok: false, reason: 'missing field' };
    }
    input.focus();
    const cs = getComputedStyle(input);
    const caretX =
      input.getBoundingClientRect().left +
      parseFloat(cs.paddingLeft) +
      parseFloat(cs.borderLeftWidth);
    const placeholderLeft = placeholder.getBoundingClientRect().left;
    return {
      ok: true,
      caretX,
      placeholderLeft,
      diff: Math.abs(caretX - placeholderLeft),
      align: cs.textAlign,
      value: input.value,
      placeholder: placeholder.textContent,
    };
  });
}

async function runIn(browserType, name) {
  const browser = await browserType.launch(
    browserType === chromium ? { args: ['--use-gl=angle'] } : {}
  );
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await seed(page);
  await page.goto(`${BASE}/?mock=empty`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-testid="focus-task"]');
  await page.waitForTimeout(400);
  await page.getByTestId('focus-task').click();
  const empty = await measureCaret(page);
  if (!empty.ok) fail(`${name} empty field missing: ${empty.reason}`);
  if (empty.align !== 'start' && empty.align !== 'left') {
    fail(`${name} empty input should be start-aligned, got ${empty.align}`);
  }
  if (empty.placeholder !== 'Focus') {
    fail(`${name} placeholder should be Focus, got ${empty.placeholder}`);
  }
  if (empty.diff > 2) {
    fail(
      `${name} empty caret x ${empty.caretX} should match placeholder left ${empty.placeholderLeft} within 2px (diff ${empty.diff})`
    );
  }
  await publish(page, `ask_caret_empty_${name}.png`);

  await page.getByTestId('focus-task').fill('write the spec');
  await page.waitForTimeout(150);
  if ((await page.getByTestId('focus-task-placeholder').count()) !== 0) {
    fail(`${name} typed field should hide the Focus placeholder`);
  }
  const typedAlign = await page.getByTestId('focus-task').evaluate((el) => getComputedStyle(el).textAlign);
  if (typedAlign !== 'start' && typedAlign !== 'left') {
    fail(`${name} typed input should stay start-aligned in a centered field, got ${typedAlign}`);
  }
  await publish(page, `ask_caret_typed_${name}.png`);
  await page.close();
  await browser.close();
}

await runIn(chromium, 'chromium');
try {
  await runIn(webkit, 'webkit');
} catch (error) {
  fail(`WebKit caret check failed: ${error instanceof Error ? error.message : error}`);
}

if (process.exitCode) {
  console.error('e2e caret failed');
  process.exit(process.exitCode);
}
console.log('e2e caret passed');
console.log(`shots ${OUT}`);
