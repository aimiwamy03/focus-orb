import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';

const ROOT = join(__dirname, '..');
const SKIP_DIRS = new Set(['node_modules', '.git', 'artifacts', 'uploads', '.next', '.cursor']);
const CODE_EXTS = new Set(['.ts', '.tsx', '.js', '.mjs', '.css']);
const KEY_SERVER_FILES = new Set([
  'lib/voiceToken.ts',
  'lib/voiceToken.test.ts',
  'app/api/voice/token/route.ts',
  'lib/voiceSecrets.test.ts',
]);
const POSTHOG_SERVER_FILES = new Set([
  'lib/posthog.ts',
  'lib/track.test.ts',
  'app/api/events/route.ts',
  'lib/voiceSecrets.test.ts',
]);

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

describe('voice secrets stay on the server', () => {
  it('does not put ASSEMBLYAI_API_KEY in the client bundle or logs', () => {
    const hits: string[] = [];
    for (const file of walk(ROOT)) {
      const rel = relative(ROOT, file);
      const text = readFileSync(file, 'utf8');
      if (rel === 'lib/voiceSecrets.test.ts') continue;
      if (text.includes('NEXT_PUBLIC_ASSEMBLYAI')) hits.push(`${rel}: public key`);
      if (text.includes('ASSEMBLYAI_API_KEY') && !KEY_SERVER_FILES.has(rel)) {
        hits.push(`${rel}: ASSEMBLYAI_API_KEY`);
      }
      if (text.includes('console.') && /ASSEMBLYAI_API_KEY|aai_/i.test(text) && rel !== 'lib/voiceSecrets.test.ts') {
        hits.push(`${rel}: logs key`);
      }
    }
    expect(hits).toEqual([]);
  });

  it('keeps POSTHOG_KEY off the client', () => {
    const hits: string[] = [];
    for (const file of walk(ROOT)) {
      const rel = relative(ROOT, file);
      const text = readFileSync(file, 'utf8');
      if (rel === 'lib/voiceSecrets.test.ts') continue;
      if (text.includes('NEXT_PUBLIC_POSTHOG')) hits.push(`${rel}: public posthog`);
      if (text.includes('POSTHOG_KEY') && !POSTHOG_SERVER_FILES.has(rel)) {
        hits.push(`${rel}: POSTHOG_KEY`);
      }
    }
    expect(hits).toEqual([]);
  });
});
