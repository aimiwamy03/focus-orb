import { chromium } from 'playwright';
import { copyFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const BASE = process.env.MENU_BASE || 'http://localhost:3000';
const OUT = process.env.SHORTCUT_SHOTS || '/opt/cursor/artifacts/shortcut-keys';
const ARTIFACTS = '/opt/cursor/artifacts';
await mkdir(OUT, { recursive: true });
await mkdir(ARTIFACTS, { recursive: true });

function fail(message) {
  console.error(`FAIL ${message}`);
  process.exitCode = 1;
}

async function publish(page, fileName, options = {}) {
  const dest = path.join(ARTIFACTS, fileName);
  await page.screenshot({ path: dest, ...options });
  await copyFile(dest, path.join(OUT, fileName));
}

const HINTS = JSON.stringify({
  click: true,
  hover: true,
  fullscreen: true,
  chrome: true,
  'leave-tab': true,
});

async function seed(page) {
  await page.addInitScript((hints) => {
    localStorage.clear();
    sessionStorage.setItem('focusOrb:introPlayed', '1');
    sessionStorage.setItem('focusOrb:settlePlayed', '1');
    localStorage.setItem('focusOrb:shortcutsCard', '1');
    localStorage.setItem('focusOrb:hints', hints);
    Object.defineProperty(window, 'documentPictureInPicture', {
      configurable: true,
      value: { requestWindow: async () => ({}) },
    });
  }, HINTS);
}

async function boxOf(locator) {
  return locator.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return {
      x: r.x,
      y: r.y,
      w: r.width,
      h: r.height,
      cx: r.x + r.width / 2,
      cy: r.y + r.height / 2,
      right: r.x + r.width,
    };
  });
}

async function capBox(page, testId) {
  return boxOf(page.getByTestId('short-help').getByTestId(testId));
}

async function openApp(browser, search) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await seed(page);
  await page.goto(`${BASE}${search}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-testid="help-toggle"]');
  await page.waitForTimeout(400);
  return page;
}

const browser = await chromium.launch({ args: ['--use-gl=angle'] });

async function assertMenu(page, label) {
  const toggle = page.getByTestId('help-toggle');
  if ((await toggle.getAttribute('title')) !== null) {
    fail(`${label}: help-toggle still has a title tooltip`);
  }
  if ((await toggle.getAttribute('aria-label')) !== 'Shortcuts') {
    fail(`${label}: help-toggle should keep an aria-label`);
  }
  if ((await page.getByTestId('pop-out').count()) !== 0) {
    fail(`${label}: chrome rows should stay inside the closed menu`);
  }

  const helpClosed = await boxOf(toggle);
  if (helpClosed.right < 1240) {
    fail(`${label}: ? should sit top-right, right=${helpClosed.right}`);
  }

  await toggle.click();
  await page.waitForSelector('[data-testid="short-help"]');
  await page.waitForTimeout(200);

  const letters = ['F', 'S', 'P', 'M', 'L'];
  const squares = {};
  for (const letter of letters) {
    squares[letter] = await capBox(page, `keycap-${letter}`);
  }
  const space = await capBox(page, 'keycap-Space');
  const help = await boxOf(page.getByTestId('help-toggle'));

  for (const letter of letters) {
    const cap = squares[letter];
    if (Math.abs(cap.w - cap.h) > 0.6) {
      fail(`${label} ${letter} is not square: ${cap.w.toFixed(2)}×${cap.h.toFixed(2)}`);
    }
    if (Math.abs(cap.w - squares.F.w) > 0.6) {
      fail(`${label} ${letter} size != F`);
    }
    if (Math.abs(cap.right - squares.F.right) > 1) {
      fail(`${label} ${letter} should share the right key column`);
    }
  }

  if (Math.abs(space.h - squares.F.h) > 0.6) {
    fail(`${label}: Space height should match squares`);
  }
  if (space.w <= squares.F.w + 2) {
    fail(`${label}: Space should be wider than the squares`);
  }
  if (Math.abs(space.right - squares.F.right) > 1) {
    fail(`${label}: Space right edge should match the square column`);
  }
  if (Math.abs(help.w - squares.F.w) > 1) {
    fail(`${label}: ? width should match the squares`);
  }
  if (Math.abs(help.cx - squares.F.cx) > 1) {
    fail(`${label}: ? center ${help.cx.toFixed(2)} should line up with F ${squares.F.cx.toFixed(2)}`);
  }

  for (const testId of [
    'fullscreen-toggle',
    'settings-gear',
    'chrome-focus',
    'pop-out',
    'mini-only',
    'focus-log-open',
  ]) {
    const row = page.getByTestId('short-help').getByTestId(testId);
    if ((await row.count()) !== 1) fail(`${label}: missing ${testId}`);
    const cls = await row.getAttribute('class');
    if (cls && /rounded-full|ring-2/.test(cls)) {
      fail(`${label}: ${testId} should not use a pill highlight`);
    }
  }

  const agenda = page.getByTestId('agenda');
  if ((await agenda.count()) === 1) {
    const agendaBox = await agenda.boundingBox();
    const menuBox = await page.getByTestId('short-help').boundingBox();
    if (
      agendaBox &&
      menuBox &&
      agendaBox.x + agendaBox.width > menuBox.x + 1 &&
      agendaBox.y < menuBox.y + menuBox.height
    ) {
      fail(`${label}: menu overlaps the left agenda`);
    }
  }

  return { squares, space, help };
}

const mock = await openApp(browser, '/?mock=back-to-back&hover=1');
await publish(mock, 'chrome_menu_mock_closed.png');
await copyFile(
  path.join(ARTIFACTS, 'chrome_menu_mock_closed.png'),
  path.join(ARTIFACTS, 'walkthrough_chrome_menu_mock_closed.png')
);
const mockGeom = await assertMenu(mock, 'mock');
const mockPanel = await mock.getByTestId('short-help').boundingBox();
const mockClip = {
  x: Math.max(0, (mockPanel?.x ?? 980) - 24),
  y: Math.max(0, mockGeom.help.y - 16),
  width: Math.min(360, 1280 - ((mockPanel?.x ?? 980) - 24)),
  height: Math.min(380, (mockPanel?.y ?? 80) + (mockPanel?.height ?? 220) - mockGeom.help.y + 40),
};
await publish(mock, 'shortcut_keys_zoomed.png', { clip: mockClip });
await publish(mock, 'chrome_menu_mock_open.png');
await copyFile(
  path.join(ARTIFACTS, 'shortcut_keys_zoomed.png'),
  path.join(ARTIFACTS, 'walkthrough_shortcut_keys_zoomed.png')
);
await copyFile(
  path.join(ARTIFACTS, 'chrome_menu_mock_open.png'),
  path.join(ARTIFACTS, 'walkthrough_chrome_menu_mock_open.png')
);
await mock.close();

const live = await openApp(browser, '/?whoop=green&hover=1');
if ((await live.getByTestId('sample-day-label').count()) !== 0) {
  fail('live mode should not show the sample-day label');
}
await publish(live, 'chrome_menu_live_closed.png');
await copyFile(
  path.join(ARTIFACTS, 'chrome_menu_live_closed.png'),
  path.join(ARTIFACTS, 'walkthrough_chrome_menu_live_closed.png')
);
await assertMenu(live, 'live');
await publish(live, 'chrome_menu_live_open.png');
await copyFile(
  path.join(ARTIFACTS, 'chrome_menu_live_open.png'),
  path.join(ARTIFACTS, 'walkthrough_chrome_menu_live_open.png')
);
await live.getByTestId('focus-log-open').click();
await live.waitForTimeout(250);
if ((await live.getByTestId('focus-log').count()) !== 1) {
  fail('live: Log row should open the focus log');
}
await live.close();

console.log({ mock: mockGeom.squares.F, help: mockGeom.help });
await browser.close();

if (process.exitCode) {
  console.error('e2e shortcut-keys failed');
  process.exit(process.exitCode);
}
console.log('e2e shortcut-keys passed');
