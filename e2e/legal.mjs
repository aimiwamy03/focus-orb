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

async function open(browser, search) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.goto(`${BASE}${search}`, { waitUntil: 'networkidle' });
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

const home = await open(browser, '/');
await assertPublic(home, 'signed-out home');
if ((await home.getByTestId('about-heading').textContent()) !== 'Focus Orb') {
  fail('Signed-out home should explain Focus Orb');
}
if ((await home.getByTestId('legal-privacy').count()) !== 1) {
  fail('Home should link to Privacy');
}
if ((await home.getByTestId('legal-terms').count()) !== 1) {
  fail('Home should link to Terms');
}
await publish(home, 'legal_home.png');
await home.close();

const about = await open(browser, '/about');
await assertPublic(about, 'about');
if ((await about.getByTestId('about-calendar').textContent() || '').includes('only reads') === false) {
  fail('About should explain read-only Calendar use');
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
]) {
  if ((await privacy.getByTestId(id).count()) !== 1) fail(`Privacy missing ${id}`);
}
if (!((await privacy.getByTestId('privacy-contact').textContent()) || '').includes('hello@example.com')) {
  fail('Privacy should include the contact placeholder');
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

const app = await open(browser, '/?mock=empty&intro=0');
if ((await app.getByTestId('orb-canvas').count()) !== 1) {
  fail('App preview params should still open the timer');
}
if ((await app.getByTestId('legal-page').count()) !== 0) {
  fail('The timer should not render the public homepage');
}
await app.close();

await browser.close();
if (process.exitCode) {
  console.error('e2e legal failed');
  process.exit(process.exitCode);
}
console.log('e2e legal passed');
