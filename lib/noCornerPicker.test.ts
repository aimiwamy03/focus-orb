import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

function listSource(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return listSource(path);
    if (!/\.(tsx|ts|jsx|js)$/.test(name)) return [];
    return [path];
  });
}

describe('no corner duration picker', () => {
  const sources = listSource('components');

  it('does not ship the old Start focus pill, popover, or 25 min picker', () => {
    const forbidden = [
      'FocusControl',
      'Start focus',
      '25 min',
      '50 min',
      '90 min',
      'smart-focus',
    ];

    for (const file of sources) {
      const src = readFileSync(file, 'utf8');
      for (const token of forbidden) {
        expect(src, `${file} still contains "${token}"`).not.toContain(token);
      }
    }
  });
});
