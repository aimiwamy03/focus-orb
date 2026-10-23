import { chromium } from 'playwright';
import { copyFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const BASE = process.env.MENU_BASE || 'http://localhost:3000';
const OUT = process.env.VOICE_SHOTS || '/opt/cursor/artifacts/voice';
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

const HINTS = JSON.stringify({
  click: true,
  hover: true,
  fullscreen: true,
  chrome: true,
  'leave-tab': true,
});

async function seed(page) {
  await page.addInitScript(
    (hints) => {
      localStorage.clear();
      sessionStorage.setItem('focusOrb:introPlayed', '1');
      sessionStorage.setItem('focusOrb:settlePlayed', '1');
      localStorage.setItem('focusOrb:hints', hints);
      localStorage.setItem('focusOrb:shortcutsCard', '1');
      Object.defineProperty(window, 'speechSynthesis', {
        configurable: true,
        value: { cancel() {}, speak() {} },
      });
    },
    HINTS
  );
}

function contrastOk(className, label) {
  if (/rounded-full/.test(className) || /\bbadge\b/.test(className)) {
    fail(`${label} should stay plain text, got ${className}`);
  }
}

const browser = await chromium.launch({ args: ['--use-gl=angle'] });

try {
  const help = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await seed(help);
  await help.goto(`${BASE}/?mock=open-afternoon&hover=1&voice=mock`, { waitUntil: 'networkidle' });
  await help.waitForSelector('[data-testid="help-toggle"]');
  await help.getByTestId('help-toggle').click();
  await help.waitForSelector('[data-testid="short-help"]');
  const voiceCap = help.getByTestId('short-help').getByTestId('keycap-V');
  await voiceCap.waitFor();
  const capBox = await voiceCap.boundingBox();
  if (!capBox) fail('Voice V keycap missing from ? menu');
  if (Math.abs(capBox.width - 24) > 1.5 || Math.abs(capBox.height - 24) > 1.5) {
    fail(`Voice V should be a 24px square, got ${capBox.width}x${capBox.height}`);
  }
  const helpText = await help.getByTestId('short-help').innerText();
  if (!helpText.includes('Voice')) fail('? menu should list Voice V');
  if (helpText.includes('—') || helpText.includes('–')) fail('? menu has an em dash');
  await publish(help, 'voice_help_menu.png');
  await help.close();

  const listen = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await seed(listen);
  await listen.goto(`${BASE}/?mock=open-afternoon&hover=1&voice=mock`, { waitUntil: 'networkidle' });
  await listen.waitForSelector('[data-testid="voice-mic"]');
  await listen.keyboard.down('v');
  await listen.waitForSelector('[data-testid="voice-listening"]');
  const listening = listen.getByTestId('voice-listening');
  contrastOk(await listening.getAttribute('class'), 'listening');
  if ((await listening.innerText()).trim() !== 'Listening') fail('Listening copy mismatch');
  await publish(listen, 'voice_listening.png');
  await listen.keyboard.up('v');
  await listen.close();

  const confirm = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await seed(confirm);
  await confirm.goto(`${BASE}/?mock=open-afternoon&hover=1&voice=mock`, { waitUntil: 'networkidle' });
  await confirm.waitForSelector('[data-testid="voice-mock-input"]');
  await confirm.getByTestId('voice-mock-input').fill('Orb, 40 minutes on the Mercor application');
  await confirm.getByTestId('voice-mock-submit').click();
  await confirm.waitForSelector('[data-testid="voice-confirm"]');
  const confirmText = (await confirm.getByTestId('voice-confirm').innerText()).trim();
  if (confirmText !== 'Starting 40m on Mercor application') {
    fail(`Confirm copy was "${confirmText}"`);
  }
  contrastOk(await confirm.getByTestId('voice-confirm').getAttribute('class'), 'confirm');
  await confirm.getByTestId('voice-cancel').waitFor();
  await publish(confirm, 'voice_confirm.png');
  await confirm.getByTestId('voice-cancel').click();
  await confirm.close();

  const conflict = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await seed(conflict);
  await conflict.goto(`${BASE}/?mock=short-gap&now=13:00&hover=1&voice=mock`, {
    waitUntil: 'networkidle',
  });
  await conflict.waitForSelector('[data-testid="voice-mock-input"]');
  await conflict.getByTestId('voice-mock-input').fill('40 minutes on the Mercor application');
  await conflict.getByTestId('voice-mock-submit').click();
  await conflict.waitForSelector('[data-testid="voice-conflict"]');
  const conflictText = (await conflict.getByTestId('voice-conflict').innerText()).trim();
  if (conflictText !== 'You have 30 minutes before Design sync. Do 30?') {
    fail(`Conflict copy was "${conflictText}"`);
  }
  if (conflictText.includes('—') || conflictText.includes('–')) fail('Conflict has an em dash');
  contrastOk(await conflict.getByTestId('voice-conflict').getAttribute('class'), 'conflict');
  await publish(conflict, 'voice_conflict.png');
  await conflict.getByTestId('voice-yes').click();
  await conflict.waitForSelector('[data-testid="voice-confirm"]');
  const adjusted = (await conflict.getByTestId('voice-confirm').innerText()).trim();
  if (adjusted !== 'Starting 30m on Mercor application') {
    fail(`Adjusted confirm was "${adjusted}"`);
  }
  await conflict.close();

  const error = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await seed(error);
  await error.goto(`${BASE}/?mock=open-afternoon&hover=1`, { waitUntil: 'networkidle' });
  await error.waitForSelector('[data-testid="voice-mic"]');
  await error.keyboard.down('v');
  await error.waitForSelector('[data-testid="voice-error"]', { timeout: 8000 });
  const errorText = (await error.getByTestId('voice-error').innerText()).trim();
  if (errorText !== "Voice isn't set up yet") fail(`Error copy was "${errorText}"`);
  contrastOk(await error.getByTestId('voice-error').getAttribute('class'), 'error');
  await publish(error, 'voice_error.png');
  await error.keyboard.up('v');
  await error.close();

  const denied = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await seed(denied);
  await denied.route('**/api/voice/token', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ token: 'tmp_test', expires_in_seconds: 60 }),
    });
  });
  await denied.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () =>
      Promise.reject(Object.assign(new Error('denied'), { name: 'NotAllowedError' }));
  });
  await denied.goto(`${BASE}/?mock=open-afternoon&hover=1`, { waitUntil: 'networkidle' });
  await denied.waitForSelector('[data-testid="voice-mic"]');
  await denied.keyboard.down('v');
  await denied.waitForSelector('[data-testid="voice-error"]', { timeout: 8000 });
  const deniedText = (await denied.getByTestId('voice-error').innerText()).trim();
  if (deniedText !== 'Mic access is off. Allow it in the browser, or type instead.') {
    fail(`Denied copy was "${deniedText}"`);
  }
  await publish(denied, 'voice_error_denied.png');
  await denied.keyboard.up('v');
  await denied.close();

  if (process.exitCode) {
    throw new Error('voice e2e failed');
  }
  console.log(
    JSON.stringify(
      {
        ok: true,
        shots: [
          'voice_help_menu.png',
          'voice_listening.png',
          'voice_confirm.png',
          'voice_conflict.png',
          'voice_error.png',
          'voice_error_denied.png',
        ],
      },
      null,
      2
    )
  );
} finally {
  await browser.close();
}
