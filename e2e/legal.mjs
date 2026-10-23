import { chromium } from 'playwright';
import { copyFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const BASE = process.env.MENU_BASE || 'http://localhost:3000';
const OUT = process.env.LEGAL_SHOTS || '/opt/cursor/artifacts/legal';
const ARTIFACTS = '/opt/cursor/artifacts';
await mkdir(OUT, { recursive: true });
await mkdir(ARTIFACTS, { recursive: true });

function fail(message) {
  console.error(`FAIL ${message}`);
  process.exitCode = 1;
}

async function publish(page, fileName) {
  const dest = path.join(ARTIFACTS, fileName);
  await page.screenshot({ path: dest, fullPage: true, animations: 'disabled' });
  await copyFile(dest, path.join(OUT, fileName));
}

async function open(browser, search, { skipIntro = false } = {}) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.addInitScript((skip) => {
    localStorage.clear();
    sessionStorage.clear();
    if (skip) {
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
    }
  }, skipIntro);
  await page.goto(`${BASE}${search}`, { waitUntil: 'load' });
  await page.waitForTimeout(400);
  return page;
}

async function assertPublic(page, label) {
  if ((await page.getByTestId('focus-intro').count()) !== 0) {
    fail(`${label} should not show the intro`);
  }
  if ((await page.getByTestId('legal-page').count()) !== 1) {
    fail(`${label} should be a public legal page`);
  }
  const text = (await page.getByTestId('legal-page').textContent()) || '';
  if (text.includes('—') || text.includes('–')) {
    fail(`${label} should not use em or en dashes`);
  }
}

const browser = await chromium.launch({ args: ['--use-gl=angle'] });

const home = await open(browser, '/?intro=0', { skipIntro: true });
if ((await home.getByTestId('orb-canvas').count()) !== 1) {
  fail('Signed-out home should show the orb');
}
if ((await home.getByTestId('legal-page').count()) !== 0) {
  fail('Signed-out home should not be the text homepage');
}
if ((await home.getByTestId('sample-day').count()) !== 1) {
  fail('Signed-out home should still offer a sample day');
}
if ((await home.getByTestId('welcome-about').count()) !== 1) {
  fail('Signed-out home should link to About');
}
if ((await home.getByTestId('welcome-privacy').count()) !== 1) {
  fail('Signed-out home should link to Privacy');
}
if ((await home.getByTestId('welcome-terms').count()) !== 1) {
  fail('Signed-out home should link to Terms');
}
const issueBadge = home.locator('text=1 Issue');
if ((await issueBadge.count()) !== 0) {
  fail('Signed-out home should not show the Next issue overlay');
}
await publish(home, 'legal_home.png');
await home.close();

const about = await open(browser, '/about');
await assertPublic(about, 'about');
if ((await about.getByTestId('about-calendar').textContent() || '').includes('only reads') === false) {
  fail('About should explain read-only Calendar use');
}
if ((await about.getByTestId('legal-privacy').count()) !== 1) {
  fail('About should link to Privacy');
}
if ((await about.getByTestId('legal-terms').count()) !== 1) {
  fail('About should link to Terms');
}
if ((await about.getByTestId('legal-health-data').count()) !== 1) {
  fail('About should link to health data');
}
if ((await about.locator('text=1 Issue').count()) !== 0) {
  fail('About should not show the Next issue overlay');
}
await publish(about, 'legal_about.png');
await about.close();

const privacy = await open(browser, '/privacy');
await assertPublic(privacy, 'privacy');
if ((await privacy.getByRole('heading', { name: 'Privacy' }).count()) !== 1) {
  fail('Privacy heading missing');
}
for (const id of [
  'privacy-data',
  'privacy-use',
  'privacy-share',
  'privacy-store',
  'privacy-revoke',
  'privacy-contact',
  'privacy-limited-use',
  'privacy-whoop',
]) {
  if ((await privacy.getByTestId(id).count()) !== 1) fail(`Privacy missing ${id}`);
}
if (!((await privacy.getByTestId('privacy-contact').textContent()) || '').includes('hello@example.com')) {
  fail('Privacy should include the contact placeholder');
}
if (!((await privacy.getByTestId('privacy-whoop').textContent()) || '').includes('whoop_session cookie')) {
  fail('Privacy should cover the WHOOP cookie');
}
if ((await privacy.getByTestId('legal-health-data').count()) !== 1) {
  fail('Privacy should link to health data');
}
if (!((await privacy.getByTestId('privacy-intro').textContent()) || '').includes('identify you')) {
  fail('Privacy should explain identity sign-in and incremental calendar');
}
await publish(privacy, 'legal_privacy.png');
await privacy.close();

const terms = await open(browser, '/terms');
await assertPublic(terms, 'terms');
if ((await terms.getByTestId('terms-heading').textContent()) !== 'Terms') {
  fail('Terms heading missing');
}
await publish(terms, 'legal_terms.png');
await terms.close();

const health = await open(browser, '/health-data');
await assertPublic(health, 'health-data');
if ((await health.getByTestId('health-data-heading').textContent()) !== 'Consumer health data') {
  fail('Health data heading missing');
}
if (!((await health.getByTestId('health-data-store').textContent()) || '').includes('does not keep a database')) {
  fail('Health data should say there is no database');
}
if (!((await health.getByTestId('health-data-invite').textContent()) || '').includes('invite-only')) {
  fail('Health data should say WHOOP is invite-only');
}
if (!((await health.getByTestId('health-data-stop').textContent()) || '').includes('revoke')) {
  fail('Health data should say Disconnect revokes access');
}
await publish(health, 'legal_health_data.png');
await health.close();

await browser.close();
if (process.exitCode) {
  console.error('e2e legal failed');
  process.exit(process.exitCode);
}
console.log('e2e legal passed');
