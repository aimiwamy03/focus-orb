import { describe, it, expect, beforeEach } from 'vitest';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  ASK_STATUS,
  BACKDROP_BRIGHTNESS,
  BACKDROP_CENTER_SRC,
  HEADING_CONTRAST_MIN,
  ICON_HREFS,
  SHOW_BACKDROP_KEY,
  SHOW_BACKDROP_LABEL,
  STATUS_CONTRAST_MIN,
  backdropCenterHex,
  backdropHeadingContrast,
  backdropStatusContrast,
  dimOnBlack,
  loadShowBackdrop,
  saveShowBackdrop,
} from './backdrop';
import { ORB_TEXT } from './palette';

const ROOT = join(__dirname, '..');

describe('backdrop setting', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('defaults on and persists like other settings', () => {
    expect(SHOW_BACKDROP_LABEL).toBe('Backdrop');
    expect(loadShowBackdrop()).toBe(true);
    saveShowBackdrop(false);
    expect(localStorage.getItem(SHOW_BACKDROP_KEY)).toBe('0');
    expect(loadShowBackdrop()).toBe(false);
    saveShowBackdrop(true);
    expect(loadShowBackdrop()).toBe(true);
  });
});

describe('backdrop contrast at shipping brightness', () => {
  it('dims the sampled center to about 50% over black', () => {
    expect(BACKDROP_BRIGHTNESS).toBe(0.5);
    expect(dimOnBlack(BACKDROP_CENTER_SRC, 0.5)).toBe('#0c0d12');
    expect(backdropCenterHex()).toBe(dimOnBlack(BACKDROP_CENTER_SRC, 0.5 * (1 - 0.12)));
  });

  it('keeps the heading at least 15:1 on the darkened center', () => {
    expect(backdropHeadingContrast()).toBeGreaterThanOrEqual(HEADING_CONTRAST_MIN);
    expect(ORB_TEXT).toBe('#e8e8e8');
  });

  it('keeps the muted status line around 6:1 on the darkened center', () => {
    const ratio = backdropStatusContrast();
    expect(ratio).toBeGreaterThanOrEqual(STATUS_CONTRAST_MIN - 0.6);
    expect(ratio).toBeLessThan(7.5);
    expect(ASK_STATUS).toBe('#8a8a90');
  });
});

describe('brand files', () => {
  it('ships the favicon, apple-touch, and manifest icons', () => {
    const files = [
      ICON_HREFS.svg,
      ICON_HREFS.png32,
      ICON_HREFS.ico,
      ICON_HREFS.apple,
      ICON_HREFS.icon192,
      ICON_HREFS.icon512,
      '/backdrop.webp',
      '/backdrop.avif',
    ];
    for (const href of files) {
      const path = join(ROOT, 'public', href.slice(1));
      expect(existsSync(path), path).toBe(true);
      expect(statSync(path).size).toBeGreaterThan(200);
    }
    const avif = statSync(join(ROOT, 'public/backdrop.avif')).size;
    expect(avif).toBeGreaterThan(100_000);
    expect(avif).toBeLessThan(420_000);
    expect(existsSync(join(ROOT, 'app/favicon.ico'))).toBe(true);
    const layout = readFileSync(join(ROOT, 'app/layout.tsx'), 'utf8');
    expect(layout).toContain('ICON_HREFS.svg');
    expect(layout).toContain('ICON_HREFS.png32');
    expect(layout).toContain('ICON_HREFS.ico');
    expect(layout).toContain('ICON_HREFS.apple');
    const manifest = readFileSync(join(ROOT, 'app/manifest.ts'), 'utf8');
    expect(manifest).toContain('ICON_HREFS.icon192');
    expect(manifest).toContain('ICON_HREFS.icon512');
  });
});
