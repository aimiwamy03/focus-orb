import { describe, expect, it } from 'vitest';
import {
  createWhoopState,
  decryptWhoopPayload,
  encryptWhoopPayload,
  stateIsValid,
  whoopNeedsRefresh,
  whoopRedirectUri,
  WHOOP_STATE_MIN_LENGTH,
} from './whoopAuth';

const secret = 'test-nextauth-secret-value';

describe('WHOOP cookie crypto', () => {
  it('encrypts and decrypts a token set with the NextAuth secret', () => {
    const payload = {
      email: 'amy@example.com',
      accessToken: 'access-1',
      refreshToken: 'refresh-1',
      expiresAt: Date.now() + 3600_000,
    };
    const sealed = encryptWhoopPayload(payload, secret);
    expect(sealed).not.toContain('access-1');
    expect(decryptWhoopPayload(sealed, secret)).toEqual(payload);
    expect(decryptWhoopPayload(sealed, 'other-secret')).toBeNull();
    expect(decryptWhoopPayload('not-valid', secret)).toBeNull();
  });

  it('refreshes when fewer than five minutes remain', () => {
    const now = 1_000_000;
    expect(
      whoopNeedsRefresh(
        { email: 'a', accessToken: 'a', refreshToken: 'r', expiresAt: now + 4 * 60_000 },
        now
      )
    ).toBe(true);
    expect(
      whoopNeedsRefresh(
        { email: 'a', accessToken: 'a', refreshToken: 'r', expiresAt: now + 6 * 60_000 },
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

  it('uses a random state of at least 8 characters', () => {
    const state = createWhoopState();
    expect(state.length).toBeGreaterThanOrEqual(WHOOP_STATE_MIN_LENGTH);
    expect(stateIsValid(state, state)).toBe(true);
    expect(stateIsValid(state, 'other')).toBe(false);
    expect(stateIsValid('short', 'short')).toBe(false);
  });
});
