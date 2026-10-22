import { chromium } from 'playwright';
import { copyFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const BASE = process.env.MENU_BASE || 'http://localhost:3000';
const OUT = process.env.INTRO_SHOTS || '/opt/cursor/artifacts/intro';
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

const playPage = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await playPage.addInitScript(() => {
  localStorage.clear();
  sessionStorage.clear();
  localStorage.setItem('focusOrb:shortcutsCard', '1');
});
await playPage.goto(`${BASE}/?mock=empty&intro=1`, { waitUntil: 'networkidle' });
await playPage.waitForTimeout(400);
if ((await playPage.getByTestId('focus-intro').count()) !== 1) {
  fail('?intro=1 should play the opening intro');
}
if ((await playPage.getByTestId('focus-prompt').count()) !== 1) {
  fail('Home should be mounted under the intro');
}
await playPage.getByTestId('focus-intro').waitFor({ state: 'detached', timeout: 12000 });
if ((await playPage.getByTestId('focus-prompt').count()) !== 1) {
  fail('Intro should land on the home ask screen');
}
const heading = await playPage.locator('text=What do you want to focus on?').count();
if (!heading) fail('Home heading missing after intro');

await playPage.goto(`${BASE}/?mock=empty`, { waitUntil: 'networkidle' });
await playPage.waitForTimeout(500);
if ((await playPage.getByTestId('focus-intro').count()) !== 0) {
  fail('Second load in the same session should not replay the intro');
}
await playPage.close();

const skipPage = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await skipPage.addInitScript(() => {
  localStorage.clear();
  sessionStorage.clear();
  localStorage.setItem('focusOrb:shortcutsCard', '1');
});
await skipPage.goto(`${BASE}/?mock=empty&intro=1`, { waitUntil: 'networkidle' });
await skipPage.waitForSelector('[data-testid="focus-intro"]');
await skipPage.keyboard.press('Escape');
await skipPage.getByTestId('focus-intro').waitFor({ state: 'detached', timeout: 2000 });
if ((await skipPage.getByTestId('focus-prompt').count()) !== 1) {
  fail('Esc should skip the intro to home');
}
await skipPage.close();

const stills = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await stills.addInitScript(() => {
  localStorage.clear();
  sessionStorage.clear();
  localStorage.setItem('focusOrb:shortcutsCard', '1');
});
await stills.goto(`${BASE}/?mock=empty&intro=1&t=2.83`, { waitUntil: 'networkidle' });
await stills.waitForTimeout(400);
await publish(stills, 'intro_mid_turn.png');
await stills.goto(`${BASE}/?mock=empty&intro=1&t=3.2`, { waitUntil: 'networkidle' });
await stills.waitForTimeout(400);
const hintStyle = await stills.getByTestId('focus-intro-hint').evaluate((el) => {
  const style = getComputedStyle(el);
  return { color: style.color, size: parseFloat(style.fontSize) };
});
if (hintStyle.size < 15) fail(`Skip hint should be at least 15px, got ${hintStyle.size}`);
if (hintStyle.color !== 'rgb(161, 161, 166)') {
  fail(`Skip hint should be #a1a1a6, got ${hintStyle.color}`);
}
await publish(stills, 'intro_caption_rest.png');
await stills.goto(`${BASE}/?mock=empty&intro=1&t=7.2`, { waitUntil: 'networkidle' });
await stills.waitForTimeout(400);
await publish(stills, 'intro_dissolve_home.png');
await stills.close();

const reduced = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await reduced.emulateMedia({ reducedMotion: 'reduce' });
await reduced.addInitScript(() => {
  localStorage.clear();
  sessionStorage.clear();
  localStorage.setItem('focusOrb:shortcutsCard', '1');
});
await reduced.goto(`${BASE}/?mock=empty&intro=1&t=1.8`, { waitUntil: 'networkidle' });
await reduced.waitForTimeout(400);
const turning = await reduced.evaluate(() => {
  const scene = document.querySelector('.focus-intro-scene');
  return scene ? getComputedStyle(scene).visibility : 'missing';
});
if (turning !== 'hidden') fail(`Reduced motion should hide the cube, got ${turning}`);
await publish(reduced, 'intro_reduced.png');
await reduced.close();

const mobile = await browser.newPage({ viewport: { width: 375, height: 812 } });
await mobile.addInitScript(() => {
  localStorage.clear();
  sessionStorage.clear();
  localStorage.setItem('focusOrb:shortcutsCard', '1');
});
await mobile.goto(`${BASE}/?mock=empty&intro=1&t=1.8`, { waitUntil: 'networkidle' });
await mobile.waitForTimeout(400);
const fit = await mobile.evaluate(() => {
  const caption = document.querySelector('[data-testid="focus-intro-caption"]');
  const art = document.querySelector('[data-testid="focus-intro-art"]');
  if (!caption || !art) return { ok: false };
  const style = getComputedStyle(caption);
  const fontSize = parseFloat(style.fontSize);
  const cap = caption.getBoundingClientRect();
  const artBox = art.getBoundingClientRect();
  const nw = art.naturalWidth || 2400;
  const nh = art.naturalHeight || 1347;
  const ir = nw / nh;
  const er = artBox.width / artBox.height;
  let w;
  let h;
  if (er > ir) {
    h = artBox.height;
    w = h * ir;
  } else {
    w = artBox.width;
    h = w / ir;
  }
  const paper = {
    left: artBox.left + (artBox.width - w) / 2,
    top: artBox.top + (artBox.height - h) / 2,
    right: artBox.left + (artBox.width - w) / 2 + w,
    bottom: artBox.top + (artBox.height - h) / 2 + h,
  };
  const wrapped = cap.height >= fontSize * 1.6;
  const fits = cap.width <= window.innerWidth + 1 && cap.right <= window.innerWidth + 2;
  const overArt = cap.top >= paper.top - 8 && cap.bottom <= paper.bottom + 8;
  return {
    ok: fontSize >= 24 && wrapped && fits && overArt,
    fontSize,
    wrapped,
    fits,
    overArt,
    lines: cap.height / fontSize,
    text: caption.textContent,
    wrap: style.textWrap || style.overflowWrap,
    whiteSpace: style.whiteSpace,
  };
});
if (!fit.ok) fail(`First caption should wrap at 24px+ over the art at 375px, got ${JSON.stringify(fit)}`);
await publish(mobile, 'intro_mobile_375.png');
await mobile.close();

const settings = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await settings.addInitScript(() => {
  localStorage.clear();
  sessionStorage.setItem('focusOrb:introPlayed', '1');
  localStorage.setItem('focusOrb:shortcutsCard', '1');
});
await settings.goto(`${BASE}/?mock=empty&intro=0&settings=1`, { waitUntil: 'networkidle' });
await settings.waitForTimeout(500);
if ((await settings.getByTestId('play-intro').count()) !== 1) {
  fail('Settings should include Play intro');
}
if ((await settings.getByTestId('intro-sound').count()) !== 1) {
  fail('Settings should include Intro sound');
}
await settings.getByTestId('play-intro').scrollIntoViewIfNeeded();
await publish(settings, 'intro_settings_toggles.png');
await settings.close();

await browser.close();
if (process.exitCode) process.exit(process.exitCode);
console.log('e2e intro passed');
console.log(`shots ${OUT}`);
