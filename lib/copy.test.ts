import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { formatClockRange } from './day';
import { TYPE_SCALE } from './typeScale';
import { meetsAaContrast, ORB_BG, ORB_TEXT_QUIET } from './palette';

const ROOT = join(__dirname, '..');
const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  'artifacts',
  'uploads',
  '.next',
  '.cursor',
]);
const CODE_EXTS = new Set(['.ts', '.tsx', '.js', '.mjs', '.css']);

const BANNED = [
  ['Click', 'the', 'orb'].join(' '),
  ['Hover', 'for', 'details'].join(' '),
];

function walk(dir: string, files: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      walk(path, files);
      continue;
    }
    if (CODE_EXTS.has(extname(name))) files.push(path);
  }
  return files;
}

describe('banned leftover copy', () => {
  it('does not keep Click-the-orb or Hover-for-details in source strings', () => {
    const hits: string[] = [];
    for (const file of walk(ROOT)) {
      const rel = relative(ROOT, file);
      if (rel === 'lib/copy.test.ts') continue;
      const text = readFileSync(file, 'utf8');
      for (const phrase of BANNED) {
        if (text.includes(phrase)) hits.push(`${rel}: ${phrase}`);
      }
    }
    expect(hits).toEqual([]);
  });

  it('does not ship tiny low-contrast keycaps', () => {
    const tiny = ['text-[', '9px]'].join('');
    const faint = ['text-white/', '30'].join('');
    const hits: string[] = [];
    for (const file of walk(ROOT)) {
      const rel = relative(ROOT, file);
      if (rel === 'lib/copy.test.ts') continue;
      const text = readFileSync(file, 'utf8');
      if (text.includes(tiny) || text.includes(faint)) hits.push(rel);
    }
    expect(hits).toEqual([]);
    expect(TYPE_SCALE.key.min).toBeGreaterThanOrEqual(14);
    expect(meetsAaContrast(ORB_TEXT_QUIET, ORB_BG, 14)).toBe(true);
  });

  it('writes clock ranges with a hyphen', () => {
    const start = new Date(2026, 9, 9, 14, 0);
    const end = new Date(2026, 9, 9, 15, 0);
    expect(formatClockRange(start, end)).toBe('2:00-3:00');
    expect(formatClockRange(start, end)).not.toMatch(/[—–]/);
  });
});
