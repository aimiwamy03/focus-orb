import { chromium } from 'playwright';
import { copyFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const BASE = process.env.MENU_BASE || 'http://localhost:3000';
const OUT = process.env.SAMPLE_SHOTS || '/opt/cursor/artifacts/sample-day';
const ARTIFACTS = '/opt/cursor/artifacts';
await mkdir(OUT, { recursive: true });
await mkdir(ARTIFACTS, { recursive: true });

function fail(message) {
  console.error(`FAIL ${message}`);
  process.exitCode = 1;
}

function overlap(a, b, slop = 0.5) {
  return (
    a.left < b.right - slop &&
    a.right > b.left + slop &&
    a.top < b.bottom - slop &&
    a.bottom > b.top + slop
  );
}

async function publish(page, fileName) {
  const dest = path.join(ARTIFACTS, fileName);
  await page.screenshot({ path: dest });
  await copyFile(dest, path.join(OUT, fileName));
}

const HINTS = JSON.stringify({
  click: true,
  hover: true,
  fullscreen: true,
  chrome: true,
  'leave-tab': true,
});

async function seed(page, extra = {}) {
  await page.addInitScript(
    ({ hints, extra }) => {
      localStorage.clear();
      sessionStorage.setItem('focusOrb:introPlayed', '1');
      localStorage.setItem('focusOrb:hints', hints);
      for (const [key, value] of Object.entries(extra)) localStorage.setItem(key, value);
      Object.defineProperty(window, 'documentPictureInPicture', {
        configurable: true,
        value: {
          requestWindow: async ({ width = 180, height = 180 } = {}) => {
            const frame = document.createElement('iframe');
            frame.setAttribute('data-testid', 'pip-window');
            frame.style.cssText = `position:fixed;left:16px;bottom:16px;width:${width}px;height:${height}px;border:1px solid #333;z-index:90;background:#000`;
            document.body.appendChild(frame);
            const doc = frame.contentDocument;
            doc.open();
            doc.write('<!doctype html><html><head></head><body></body></html>');
            doc.close();
            const win = frame.contentWindow;
            Object.defineProperty(win, 'innerWidth', { get: () => frame.clientWidth });
            Object.defineProperty(win, 'innerHeight', { get: () => frame.clientHeight });
            win.closed = false;
            win.close = () => {
              if (win.closed) return;
              win.closed = true;
              win.dispatchEvent(new Event('pagehide'));
              frame.remove();
            };
            return win;
          },
        },
      });
    },
    { hints: HINTS, extra }
  );
}

const browser = await chromium.launch({ args: ['--use-gl=angle'] });

const tips = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await seed(tips);
await tips.goto(`${BASE}/?mock=back-to-back`, { waitUntil: 'networkidle' });
await tips.waitForSelector('[data-testid="shortcuts-card"]');
await tips.waitForSelector('[data-testid="sample-day-label"]');
const cardBox = await tips.getByTestId('shortcuts-card').boundingBox();
const promptBox = await tips.getByTestId('focus-prompt').boundingBox();
const agendaBox = await tips.getByTestId('agenda').boundingBox();
if (!cardBox) fail('Shortcuts card missing on sample day');
if (cardBox.x > 32) fail(`Sample-day tips should sit near the left edge, x=${cardBox.x}`);
if (cardBox.y > 80) fail(`Sample-day tips should sit near the top, y=${cardBox.y}`);
if (promptBox && overlap(
  { left: cardBox.x, top: cardBox.y, right: cardBox.x + cardBox.width, bottom: cardBox.y + cardBox.height },
  { left: promptBox.x, top: promptBox.y, right: promptBox.x + promptBox.width, bottom: promptBox.y + promptBox.height }
)) {
  fail('Sample-day tips overlap the Start / Ask stack');
}
if (agendaBox && overlap(
  { left: cardBox.x, top: cardBox.y, right: cardBox.x + cardBox.width, bottom: cardBox.y + cardBox.height },
  { left: agendaBox.x, top: agendaBox.y, right: agendaBox.x + agendaBox.width, bottom: agendaBox.y + agendaBox.height }
)) {
  fail('Sample-day tips overlap the left agenda card');
}
const cardClass = await tips.getByTestId('shortcuts-card').getAttribute('class');
if (!cardClass || !cardClass.includes('fixed') || !cardClass.includes('top-4') || !cardClass.includes('left-4')) {
  fail(`Sample-day tips should match live top-left help, got ${cardClass}`);
}
if (cardClass.includes('text-center')) fail('Sample-day tips should not be centered');
await publish(tips, 'sample_day_tips_desktop.png');
await tips.getByTestId('shortcuts-got-it').click();
await tips.waitForTimeout(200);
if ((await tips.getByTestId('shortcuts-card').count()) !== 0) {
  fail('Got it should dismiss the sample-day tips');
}
await tips.close();

const narrow = await browser.newPage({ viewport: { width: 375, height: 812 } });
await seed(narrow);
await narrow.goto(`${BASE}/?mock=back-to-back`, { waitUntil: 'networkidle' });
await narrow.waitForSelector('[data-testid="shortcuts-card"]');
const narrowBox = await narrow.getByTestId('shortcuts-card').boundingBox();
if (!narrowBox) fail('Narrow sample-day tips missing');
if (narrowBox.x > 32 || narrowBox.y > 80) {
  fail(`Narrow tips should stay top-left, got x=${narrowBox.x} y=${narrowBox.y}`);
}
await publish(narrow, 'sample_day_tips_narrow.png');
await narrow.close();

const mini = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await seed(mini, { 'focusOrb:shortcutsCard': '1' });
await mini.goto(`${BASE}/?mock=back-to-back`, { waitUntil: 'networkidle' });
await mini.waitForSelector('[data-testid="focus-prompt"]');
await mini.waitForTimeout(400);
const pipBefore = await mini.evaluate(() => Boolean(window.documentPictureInPicture));
if (!pipBefore) fail('Sample-day e2e needs a Document Picture-in-Picture shim');
await mini.getByTestId('focus-task').blur();
await mini.mouse.move(20, 20);
await mini.waitForTimeout(200);
if ((await mini.getByTestId('pop-out').count()) !== 1) {
  fail('Sample day should show Pop out when Document PiP is available');
}
await mini.keyboard.press('p');
const pip = mini.frameLocator('[data-testid="pip-window"]');
await pip.getByTestId('mini-orb').waitFor({ timeout: 4000 });
const idleStatus = await pip.getByTestId('mini-status').textContent();
if (!idleStatus || (!idleStatus.includes('Free') && !idleStatus.includes('Meeting') && !idleStatus.includes('Clear'))) {
  fail(`Sample-day mini should show mock calendar state, got ${idleStatus}`);
}
await publish(mini, 'sample_day_mini_open.png');
await mini.getByTestId('duration-50m').click();
await mini.getByTestId('focus-start').click();
await mini.waitForTimeout(500);
const focusStatus = await pip.getByTestId('mini-status').textContent();
if (!focusStatus || !focusStatus.toLowerCase().includes('focus')) {
  fail(`Sample-day mini should sync to a started focus block, got ${focusStatus}`);
}
await mini.getByTestId('focus-task-name').waitFor();
await mini.keyboard.press('p');
await mini.waitForTimeout(300);
if ((await mini.locator('[data-testid="pip-window"]').count()) !== 0) {
  fail('P should close the sample-day mini window');
}
await mini.close();

const ASK_RECENTS = JSON.stringify(['finish voice ai post', 'write the spec', 'review pr']);

async function askStyleTokens(page) {
  return page.evaluate(() => {
    const visual = (el) => (el?.querySelector('span') && el.querySelector('span').childElementCount === 0 ? el.querySelector('span') : el);
    const chip = visual(document.querySelector('[data-testid="duration-50m"]'));
    const start = visual(document.querySelector('[data-testid="focus-start"]'));
    const suggestion = document.querySelector('[data-testid="recent-finish voice ai post"]');
    const input = document.querySelector('[data-testid="focus-task"]');
    const read = (el) => {
      if (!el) return null;
      const s = getComputedStyle(el);
      return {
        className: el.className,
        color: s.color,
        background: s.backgroundColor,
        radius: s.borderRadius,
        borderBottom: `${s.borderBottomWidth} ${s.borderBottomStyle} ${s.borderBottomColor}`,
        fontSize: s.fontSize,
        textAlign: s.textAlign,
        cursor: s.cursor,
      };
    };
    return {
      chip: read(chip),
      start: read(start),
      suggestion: read(suggestion),
      input: read(input),
      suggestionRow: document.querySelector('[data-testid="recent-tasks"]')?.className ?? null,
      hasTimeline: Boolean(document.querySelector('[data-testid="timeline"]')),
      hasSample: Boolean(document.querySelector('[data-testid="sample-day-label"]')),
      extraPills: [...document.querySelector('[data-testid="bottom-stack"]')?.children ?? []]
        .map((el) => el.getAttribute('data-testid'))
        .filter(Boolean),
    };
  });
}

const mockAsk = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await seed(mockAsk, { 'focusOrb:shortcutsCard': '1', 'focusOrb:recentTasks': ASK_RECENTS });
await mockAsk.goto(`${BASE}/?mock=back-to-back`, { waitUntil: 'networkidle' });
await mockAsk.waitForSelector('[data-testid="focus-prompt"]');
await mockAsk.waitForSelector('[data-testid="recent-tasks"]');
const mockTokens = await askStyleTokens(mockAsk);
if (mockTokens.hasTimeline) fail('Ask sample day should not render the timeline track');
if (!mockTokens.hasSample) fail('Sample day label should remain on the mock view');
if (!mockTokens.suggestion || mockTokens.suggestion.className !== 'ask-suggestion') {
  fail(`Sample day should use CUT-009 suggestion styles, got ${JSON.stringify(mockTokens.suggestion)}`);
}
if (mockTokens.suggestionRow !== 'ask-suggestions') {
  fail(`Sample day suggestion row class ${mockTokens.suggestionRow}`);
}
if (mockTokens.extraPills.some((id) => id !== 'focus-prompt' && id !== 'sample-day-label')) {
  fail(`Unexpected bottom-stack siblings on sample day: ${mockTokens.extraPills}`);
}
await publish(mockAsk, 'sample_day_ask_styled.png');

const signedAsk = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await seed(signedAsk, { 'focusOrb:shortcutsCard': '1', 'focusOrb:recentTasks': ASK_RECENTS });
await signedAsk.goto(`${BASE}/?mockCalendars=1`, { waitUntil: 'networkidle' });
await signedAsk.waitForSelector('[data-testid="focus-prompt"]');
await signedAsk.waitForSelector('[data-testid="recent-tasks"]');
const liveTokens = await askStyleTokens(signedAsk);
if (liveTokens.hasSample) fail('Signed-in home should not show the Sample day label');
for (const key of ['chip', 'start', 'suggestion', 'input']) {
  const mockVal = JSON.stringify(mockTokens[key]);
  const liveVal = JSON.stringify(liveTokens[key]);
  if (mockVal !== liveVal) fail(`Ask ${key} style differs between sample day and signed-in: mock ${mockVal} vs live ${liveVal}`);
}
if (mockTokens.suggestionRow !== liveTokens.suggestionRow) {
  fail('Suggestion row class differs between sample day and signed-in');
}
await publish(signedAsk, 'signed_in_ask_styled.png');

const pair = await browser.newPage({ viewport: { width: 2560, height: 800 } });
const mockShot = (await readFile(path.join(ARTIFACTS, 'sample_day_ask_styled.png'))).toString('base64');
const liveShot = (await readFile(path.join(ARTIFACTS, 'signed_in_ask_styled.png'))).toString('base64');
await pair.setContent(`<!doctype html>
<html><body style="margin:0;background:#111;display:flex">
  <div style="width:1280px;height:800px;position:relative">
    <img src="data:image/png;base64,${mockShot}" width="1280" height="800" />
    <div style="position:absolute;left:16px;top:16px;color:#fff;font:16px sans-serif;background:#000a;padding:4px 8px">Sample day</div>
  </div>
  <div style="width:1280px;height:800px;position:relative">
    <img src="data:image/png;base64,${liveShot}" width="1280" height="800" />
    <div style="position:absolute;left:16px;top:16px;color:#fff;font:16px sans-serif;background:#000a;padding:4px 8px">Signed-in</div>
  </div>
</body></html>`);
await pair.waitForTimeout(200);
await publish(pair, 'sample_day_vs_signed_in.png');
await pair.close();
await mockAsk.close();
await signedAsk.close();

await browser.close();
if (process.exitCode) {
  console.error('e2e sample-day failed');
  process.exit(process.exitCode);
}
console.log('e2e sample-day passed');
console.log(`shots ${OUT}`);
