import { chromium } from 'playwright';
import { copyFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const BASE = process.env.MENU_BASE || 'http://localhost:3000';
const OUT = process.env.AGENDA_SHOTS || '/opt/cursor/artifacts/agenda';
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

const browser = await chromium.launch({ args: ['--use-gl=angle'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
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
await page.goto(`${BASE}/?mock=amy-thursday&now=11:50`, { waitUntil: 'networkidle' });
await page.waitForTimeout(700);

const agenda = page.getByTestId('agenda');
if ((await agenda.count()) !== 1) fail('Agenda should show during an in-progress event');
const titles = await page.locator('[data-testid^="agenda-event-"]').allTextContents();
const joined = titles.join(' | ');
if (!joined.includes('Mindspace Open House')) fail(`Missing Mindspace: ${joined}`);
if (!joined.includes('Production Agent Lab - Workshop')) fail(`Missing workshop: ${joined}`);
if (!joined.includes('Now, until 5pm')) fail(`Mindspace should be Now, until 5pm: ${joined}`);
if (joined.includes('Nothing tomorrow')) fail(`Tomorrow should list events, got: ${joined}`);
if (!joined.includes('recap with myself')) fail(`Missing tomorrow recap: ${joined}`);

await publish(page, 'agenda_amy_thursday_1150.png');
await copyFile(
  path.join(ARTIFACTS, 'agenda_amy_thursday_1150.png'),
  path.join(ARTIFACTS, 'walkthrough_agenda_amy_thursday_1150.png')
);
await page.close();
await browser.close();

if (process.exitCode) {
  console.error('e2e agenda failed');
  process.exit(process.exitCode);
}
console.log('e2e agenda passed');
console.log(`shots ${OUT}`);
