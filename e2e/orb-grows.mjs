import { chromium } from 'playwright';
import { copyFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const BASE = process.env.MENU_BASE || 'http://localhost:3000';
const OUT = process.env.ORB_GROW_SHOTS || '/opt/cursor/artifacts/orb-grows';
const ARTIFACTS = '/opt/cursor/artifacts';
await mkdir(OUT, { recursive: true });
await mkdir(ARTIFACTS, { recursive: true });

function fail(message) {
  console.error(`FAIL ${message}`);
  process.exitCode = 1;
}

async function publish(page, fileName) {
  const dest = path.join(ARTIFACTS, fileName);
  await page.screenshot({ path: dest, animations: 'disabled' });
  await copyFile(dest, path.join(OUT, fileName));
}

function seedScript(log) {
  return (payload) => {
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
    if (payload.log) localStorage.setItem('focusOrb:focusLog:mock', payload.log);
  };
}

const browser = await chromium.launch({ args: ['--use-gl=angle'] });

async function open(search, log) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.addInitScript(seedScript(log), {
    log: log ? JSON.stringify(log) : '',
  });
  await page.goto(`${BASE}${search}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  return page;
}

const stages = [
  ['cluster', 0],
  ['gathering', 45],
  ['forming', 90],
  ['full', 150],
  ['radiant', 240],
];

for (const [key] of stages) {
  const page = await open(`/?mock=empty&orb=${key}&intro=0&settle=0&hover=1`);
  const root = page.getByTestId('orb-root');
  if ((await root.getAttribute('data-orb-stage')) !== key) {
    fail(`?orb=${key} should show the ${key} stage`);
  }
  if ((await root.getAttribute('data-orb-moment')) !== 'still') {
    fail(`?orb=${key} should stay still on open`);
  }
  const heading = await page.locator("text=What's the one thing?").count();
  if (!heading) fail(`Ask heading missing on ${key}`);
  await publish(page, `orb_stage_${key}.png`);
  await page.close();
}

const abandoned = [
  {
    id: 'short',
    task: 'too short',
    startMs: Date.now() - 10 * 60_000,
    endMs: Date.now(),
    minutes: 10,
    planned: 25,
    ended: 'ended-early',
  },
];
const fallback = await open(`/?mock=empty&intro=0&settle=0`, abandoned);
if ((await fallback.getByTestId('orb-root').getAttribute('data-orb-stage')) !== 'cluster') {
  fail('A 10m abandoned session should not grow the orb');
}
if ((await fallback.getByTestId('orb-root').getAttribute('data-orb-minutes')) !== '0') {
  fail('Abandoned sessions under 15m should count as 0');
}
await fallback.close();

const counted = [
  {
    id: 'am',
    task: 'write the spec',
    startMs: Date.now() - 50 * 60_000,
    endMs: Date.now() - 25 * 60_000,
    minutes: 50,
    planned: 50,
    ended: 'completed',
  },
];
const gathering = await open(`/?mock=empty&intro=0&settle=0`, counted);
if ((await gathering.getByTestId('orb-root').getAttribute('data-orb-stage')) !== 'gathering') {
  fail('50 counted minutes should be Gathering');
}
await gathering.close();

const settle = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await settle.addInitScript(() => {
  localStorage.clear();
  sessionStorage.setItem('focusOrb:introPlayed', '1');
  localStorage.setItem('focusOrb:shortcutsCard', '1');
});
await settle.goto(`${BASE}/?mock=empty&orb=settle&orbT=8&intro=0`, { waitUntil: 'networkidle' });
await settle.waitForTimeout(400);
if ((await settle.getByTestId('focus-settle').count()) !== 1) {
  fail('?orb=settle should show the settle ritual');
}
if ((await settle.getByTestId('orb-root').getAttribute('data-orb-moment')) !== 'settle') {
  fail('Settle preview should mark the settle moment');
}
if ((await settle.locator("text=What's the one thing?").count()) !== 0) {
  fail('Settle should not ask the one thing yet');
}
const hint = await settle.getByTestId('settle-hint').textContent();
if (hint !== 'Esc to skip') fail(`Settle hint should be Esc to skip, got ${hint}`);
await publish(settle, 'orb_settle.png');
await settle.keyboard.press('Escape');
await settle.getByTestId('focus-settle').waitFor({ state: 'detached', timeout: 2000 });
if ((await settle.locator("text=What's the one thing?").count()) !== 1) {
  fail('Skipping settle should ask What\'s the one thing?');
}
await settle.close();

const bloom = await open(`/?mock=empty&orb=bloom&orbT=1.2&intro=0&settle=0`);
if ((await bloom.getByTestId('orb-root').getAttribute('data-orb-moment')) !== 'bloom') {
  fail('?orb=bloom should play the end bloom');
}
if ((await bloom.getByTestId('focused-today').textContent()) !== '1h 45m focused today.') {
  fail('Bloom should show 1h 45m focused today.');
}
if ((await bloom.getByTestId('next-step').count()) !== 0) {
  fail('The next-step note should wait until bloom ends');
}
await publish(bloom, 'orb_bloom.png');
await bloom.close();

const afterBloom = await open(`/?mock=empty&orb=bloom&intro=0&settle=0`);
await afterBloom.waitForTimeout(2800);
if ((await afterBloom.getByTestId('next-step').count()) !== 1) {
  fail('After bloom, the where-I-stopped note should appear');
}
if ((await afterBloom.getByTestId('distracted-prompt').textContent()).includes('—')) {
  fail('Completed copy should not use an em dash');
}
await afterBloom.getByTestId('next-step').fill('Send the recap');
await afterBloom.getByTestId('distract-no').click();
await afterBloom.getByTestId('rating-4').click();
await publish(afterBloom, 'orb_bloom_note.png');
await afterBloom.getByTestId('focus-log-open').click();
await afterBloom.waitForSelector('[data-testid="focus-log"]');
const todayStage = await afterBloom.getByTestId('focus-log-day-stage-Today').count();
if (todayStage !== 1 && (await afterBloom.getByTestId('focus-log-empty').count()) !== 1) {
  fail('Log should keep today visible after a bloom preview');
}
await afterBloom.close();

const reduced = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await reduced.emulateMedia({ reducedMotion: 'reduce' });
await reduced.addInitScript(seedScript(), { log: '' });
await reduced.goto(`${BASE}/?mock=empty&orb=bloom&orbT=0.2&intro=0&settle=0`, {
  waitUntil: 'networkidle',
});
await reduced.waitForTimeout(400);
const reducedGrowth = await reduced.evaluate(() => window.__orbGrowth || null);
if (!reducedGrowth) fail('Reduced motion bloom should still expose growth state');
await publish(reduced, 'orb_bloom_reduced.png');
await reduced.close();

await browser.close();
if (process.exitCode) {
  console.error('e2e orb-grows failed');
  process.exit(process.exitCode);
}
console.log('e2e orb-grows passed');
