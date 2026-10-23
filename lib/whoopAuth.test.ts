import { describe, expect, it } from 'vitest';
import {
  createWhoopState,
  decryptWhoopPayload,
  encryptWhoopPayload,
  isWhoopEmailInvited,
  parseWhoopInviteEmails,
  sessionWhoopMatches,
  stateIsValid,
  whoopNeedsRefresh,
  whoopRedirectUri,
  whoopSetCookieBytes,
  WHOOP_CACHE_CONTROL,
  WHOOP_COOKIE_MAX_BYTES,
  WHOOP_INVITE_EMAILS_MAX,
  WHOOP_STATE_MIN_LENGTH,
} from './whoopAuth';

const secret = 'test-nextauth-secret-value';

function tokens() {
  return {
    userId: 'sub-amy',
    email: 'amy@example.com',
    accessToken: 'access-1',
    refreshToken: 'refresh-1',
    expiresAt: Date.now() + 3600_000,
  };
}

describe('WHOOP cookie crypto', () => {
  it('encrypts and decrypts a token set with the NextAuth secret', () => {
    const payload = tokens();
    const sealed = encryptWhoopPayload(payload, secret);
    expect(sealed).not.toContain('access-1');
    expect(decryptWhoopPayload(sealed, secret)).toEqual(payload);
    expect(decryptWhoopPayload(sealed, 'other-secret')).toBeNull();
    expect(decryptWhoopPayload('not-valid', secret)).toBeNull();
  });

  it('never stores WHOOP facts in the cookie and stays under the Set-Cookie budget', () => {
    const bloated = {
      ...tokens(),
      summary: {
        connected: true,
        email: 'amy@example.com',
        status: 'ok' as const,
        facts: {
          recovery: 82,
          recoveryState: 'scored' as const,
          sleepPerformance: 90,
          sleepMinutes: 440,
          sleepDebtMinutes: 0,
          yesterdayStrain: 11,
          lastWorkoutEndedAt: null,
          wakeAt: Date.parse('2026-10-22T08:00:00Z'),
          now: Date.parse('2026-10-22T12:00:00Z'),
          padding: 'x'.repeat(5000),
        },
        fetchedAt: 1,
      },
    };
    const sealed = encryptWhoopPayload(bloated, secret);
    const opened = decryptWhoopPayload(sealed, secret);
    expect(opened).not.toHaveProperty('summary');
    expect(JSON.stringify(opened)).not.toContain('recovery');
    expect(whoopSetCookieBytes(sealed)).toBeLessThanOrEqual(WHOOP_COOKIE_MAX_BYTES);
  });

  it('refreshes when fewer than five minutes remain', () => {
    const now = 1_000_000;
    expect(
      whoopNeedsRefresh(
        { userId: 's', email: 'a', accessToken: 'a', refreshToken: 'r', expiresAt: now + 4 * 60_000 },
        now
      )
    ).toBe(true);
    expect(
      whoopNeedsRefresh(
        { userId: 's', email: 'a', accessToken: 'a', refreshToken: 'r', expiresAt: now + 6 * 60_000 },
        now
      )
    ).toBe(false);
  });
});

describe('WHOOP OAuth helpers', () => {
  it('builds the callback from NEXTAUTH_URL or the request origin', () => {
    expect(
      whoopRedirectUri('http://localhost:3000/api/whoop/connect', {
        NEXTAUTH_URL: 'https://focus-orb-one.vercel.app',
      })
    ).toBe('https://focus-orb-one.vercel.app/api/whoop/callback');
    expect(whoopRedirectUri('http://localhost:3000/api/whoop/connect', {})).toBe(
      'http://localhost:3000/api/whoop/callback'
    );
  });

  it('ties OAuth state to the Google sub', () => {
    const state = createWhoopState('sub-amy', secret);
    expect(state.length).toBeGreaterThanOrEqual(WHOOP_STATE_MIN_LENGTH);
    expect(stateIsValid(state, state, 'sub-amy', secret)).toBe(true);
    expect(stateIsValid(state, state, 'sub-other', secret)).toBe(false);
    expect(stateIsValid(state, 'other', 'sub-amy', secret)).toBe(false);
    expect(stateIsValid('short', 'short', 'sub-amy', secret)).toBe(false);
  });

  it('uses private no-store on WHOOP responses', () => {
    expect(WHOOP_CACHE_CONTROL).toBe('private, no-store');
  });
});

describe('WHOOP invite list', () => {
  it('is case-insensitive, caps at 10, and lets nobody in when empty', () => {
    const parsed = parseWhoopInviteEmails(
      'Amy@Example.com, other@x.com, amy@example.com, a3@x.com, a4@x.com, a5@x.com, a6@x.com, a7@x.com, a8@x.com, a9@x.com, a10@x.com, a11@x.com'
    );
    expect(parsed[0]).toBe('amy@example.com');
    expect(parsed).toHaveLength(WHOOP_INVITE_EMAILS_MAX);
    expect(parsed).not.toContain('a11@x.com');
    expect(isWhoopEmailInvited('amy@example.com', { WHOOP_INVITE_EMAILS: 'Amy@Example.com' })).toBe(
      true
    );
    expect(isWhoopEmailInvited('other@x.com', { WHOOP_INVITE_EMAILS: 'Amy@Example.com' })).toBe(
      false
    );
    expect(isWhoopEmailInvited('amy@example.com', { WHOOP_INVITE_EMAILS: '' })).toBe(false);
    expect(isWhoopEmailInvited('amy@example.com', {})).toBe(false);
  });
});

describe('session binding', () => {
  it('requires both Google sub and email to match', () => {
    const payload = tokens();
    expect(sessionWhoopMatches(payload, { userId: 'sub-amy', email: 'amy@example.com' })).toBe(true);
    expect(sessionWhoopMatches(payload, { userId: 'sub-b', email: 'amy@example.com' })).toBe(false);
    expect(sessionWhoopMatches(payload, { userId: 'sub-amy', email: 'b@example.com' })).toBe(false);
  });
});
