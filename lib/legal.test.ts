import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  GOOGLE_CALENDAR_AUTH,
  GOOGLE_CALENDAR_SCOPES,
  GOOGLE_IDENTITY_SCOPES,
} from './googleAuth';
import {
  ABOUT_BODY,
  ABOUT_CALENDAR_BODY,
  ABOUT_LEDE,
  ABOUT_WHAT_BODY,
  CONTACT_EMAIL,
  HEALTH_DATA_INTRO,
  HEALTH_DATA_READ_BODY,
  HEALTH_DATA_STOP_BODY,
  HEALTH_DATA_STORE_BODY,
  LEGAL_COPY,
  PRIVACY_CONTACT_BODY,
  PRIVACY_DATA_BODY,
  PRIVACY_INTRO,
  PRIVACY_LIMITED_USE,
  PRIVACY_REVOKE_BODY,
  PRIVACY_SHARE_BODY,
  PRIVACY_STORE_BODY,
  PRIVACY_WHOOP_BODY,
  showsAppShell,
  TERMS_BODY,
} from './legal';

describe('public legal copy', () => {
  it('uses large-page copy without em dashes or a hardcoded vercel.app host', () => {
    for (const text of LEGAL_COPY) {
      expect(text).not.toMatch(/[—–]/);
      expect(text).not.toMatch(/vercel\.app/i);
    }
    expect(CONTACT_EMAIL).toBe('aimiw.amy03@gmail.com');
    expect(PRIVACY_CONTACT_BODY).toBe(`Questions about privacy: ${CONTACT_EMAIL}.`);
    expect(PRIVACY_CONTACT_BODY).not.toMatch(/placeholder/i);
    expect(TERMS_BODY).not.toMatch(/placeholder/i);
    expect(TERMS_BODY).toContain(CONTACT_EMAIL);
    expect(ABOUT_LEDE).toMatch(/focus timer/i);
    expect(ABOUT_CALENDAR_BODY).toMatch(/only reads/i);
    expect(ABOUT_WHAT_BODY).toMatch(/invite-only/);
    expect(ABOUT_BODY).toMatch(/invite-only/);
    expect(PRIVACY_INTRO).toMatch(/identify you/);
    expect(PRIVACY_DATA_BODY).toMatch(/read-only/i);
    expect(PRIVACY_SHARE_BODY).toMatch(/does not sell/i);
    expect(PRIVACY_STORE_BODY).toMatch(/does not write your Calendar events to its own database/i);
    expect(PRIVACY_STORE_BODY).toMatch(/Sign out clears/);
    expect(PRIVACY_REVOKE_BODY).toMatch(/myaccount\.google\.com\/permissions/);
    expect(PRIVACY_LIMITED_USE).toMatch(/Limited Use/);
    expect(TERMS_BODY).toMatch(/as is/);
  });

  it('names the WHOOP cookie rules and invite-only health policy', () => {
    expect(PRIVACY_CONTACT_BODY).toContain(CONTACT_EMAIL);
    expect(PRIVACY_WHOOP_BODY).toMatch(/whoop_session cookie/);
    expect(PRIVACY_WHOOP_BODY).toMatch(/does not write WHOOP data to a database/);
    expect(PRIVACY_WHOOP_BODY).toMatch(/invite-only/);
    expect(PRIVACY_WHOOP_BODY).toMatch(/Disconnect in Settings revokes/);
    expect(PRIVACY_WHOOP_BODY).toMatch(/Sign out only deletes the cookie/);
    expect(HEALTH_DATA_STORE_BODY).toMatch(/does not keep a database/);
    expect(HEALTH_DATA_READ_BODY).toMatch(/Recovery, sleep, and daily cycles/);
    expect(HEALTH_DATA_STOP_BODY).toMatch(/remove Focus Orb in the WHOOP app/);
    expect(HEALTH_DATA_INTRO).toMatch(/consumer health data policy/);
  });

  it('opens the app shell only for preview or signed-in query keys', () => {
    expect(showsAppShell({})).toBe(false);
    expect(showsAppShell({ mock: 'empty' })).toBe(true);
    expect(showsAppShell({ intro: '0' })).toBe(true);
    expect(showsAppShell(new URLSearchParams('whoop=red'))).toBe(true);
  });
});

describe('custom domain', () => {
  it('does not hardcode vercel.app in app or lib source', () => {
    const root = join(__dirname, '..');
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        if (name === 'node_modules' || name === '.next' || name.endsWith('.test.ts') || name.endsWith('.test.tsx')) {
          continue;
        }
        const path = join(dir, name);
        if (statSync(path).isDirectory()) {
          walk(path);
          continue;
        }
        if (!['.ts', '.tsx'].includes(extname(name))) continue;
        const text = readFileSync(path, 'utf8');
        if (text.includes('vercel.app')) hits.push(relative(root, path));
      }
    };
    walk(join(root, 'app'));
    walk(join(root, 'lib'));
    expect(hits).toEqual([]);
  });

  it('does not keep a placeholder contact email in app, lib, or e2e copy', () => {
    const root = join(__dirname, '..');
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        if (name === 'node_modules' || name === '.next' || name.endsWith('.test.ts') || name.endsWith('.test.tsx')) continue;
        const path = join(dir, name);
        if (statSync(path).isDirectory()) {
          walk(path);
          continue;
        }
        if (!['.ts', '.tsx', '.mjs', '.md'].includes(extname(name))) continue;
        const text = readFileSync(path, 'utf8');
        if (/placeholder address/i.test(text) || /you@example\.com/i.test(text)) {
          hits.push(relative(root, path));
        }
      }
    };
    walk(join(root, 'app'));
    walk(join(root, 'lib'));
    walk(join(root, 'e2e'));
    walk(join(root, 'components'));
    expect(hits).toEqual([]);
  });
});

describe('Google scopes for verification', () => {
  it('lists identity sign-in separately from incremental calendar scopes', () => {
    expect(GOOGLE_IDENTITY_SCOPES).toBe('openid email profile');
    expect(GOOGLE_IDENTITY_SCOPES).not.toContain('calendar');
    expect(GOOGLE_CALENDAR_SCOPES.split(' ')).toEqual([
      'openid',
      'email',
      'profile',
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/calendar.events.readonly',
    ]);
    expect(GOOGLE_CALENDAR_SCOPES).not.toContain('calendar.write');
    expect(GOOGLE_CALENDAR_SCOPES).not.toMatch(/vercel\.app/);
    expect(GOOGLE_CALENDAR_AUTH.include_granted_scopes).toBe('true');
  });
});
