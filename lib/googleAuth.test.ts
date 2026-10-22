import { describe, it, expect, vi } from 'vitest';
import {
  applyGoogleAccountToToken,
  attachGoogleAccessToSession,
  authSecret,
  authUrl,
  GOOGLE_CALENDAR_SCOPES,
  googleClientId,
  googleClientSecret,
  googleJwtNeedsRefresh,
  isGoogleAuthConfigured,
  refreshGoogleAccessToken,
  unconfiguredSessionBody,
} from './googleAuth';

describe('Google auth env aliases', () => {
  it('accepts AUTH_GOOGLE_* and AUTH_SECRET/AUTH_URL as well as the legacy names', () => {
    expect(
      isGoogleAuthConfigured({
        AUTH_GOOGLE_ID: 'id',
        AUTH_GOOGLE_SECRET: 'secret',
        AUTH_SECRET: 'jwt-secret',
      })
    ).toBe(true);

    expect(
      isGoogleAuthConfigured({
        GOOGLE_CLIENT_ID: 'id',
        GOOGLE_CLIENT_SECRET: 'secret',
        NEXTAUTH_SECRET: 'jwt-secret',
      })
    ).toBe(true);

    expect(googleClientId({ AUTH_GOOGLE_ID: 'from-auth' })).toBe('from-auth');
    expect(googleClientSecret({ GOOGLE_CLIENT_SECRET: 'legacy' })).toBe('legacy');
    expect(authSecret({ NEXTAUTH_SECRET: 'n' })).toBe('n');
    expect(authUrl({ AUTH_URL: 'https://focus-orb-one.vercel.app' })).toBe(
      'https://focus-orb-one.vercel.app'
    );
  });

  it('is not configured when the JWT secret is missing', () => {
    expect(
      isGoogleAuthConfigured({
        GOOGLE_CLIENT_ID: 'id',
        GOOGLE_CLIENT_SECRET: 'secret',
      })
    ).toBe(false);
  });

  it('returns an empty session body instead of letting NextAuth 500', () => {
    expect(unconfiguredSessionBody()).toBeNull();
  });

  it('requests calendar.readonly so events can load after sign-in', () => {
    expect(GOOGLE_CALENDAR_SCOPES).toContain(
      'https://www.googleapis.com/auth/calendar.readonly'
    );
  });
});

describe('Google tokens on the session', () => {
  it('copies the Google access token onto the JWT and the session', () => {
    const token = applyGoogleAccountToToken(
      {},
      {
        access_token: 'ya29.access',
        refresh_token: '1//refresh',
        expires_at: 1_700_000_000,
      }
    );
    expect(token.accessToken).toBe('ya29.access');
    expect(token.refreshToken).toBe('1//refresh');

    const session = attachGoogleAccessToSession({ user: { email: 'amy@x.com' } }, token);
    expect(session.accessToken).toBe('ya29.access');
  });

  it('does not wipe an existing token when account is missing on later requests', () => {
    const existing = { accessToken: 'ya29.keep', refreshToken: '1//r', expiresAt: 9 };
    expect(applyGoogleAccountToToken(existing, null)).toEqual(existing);
  });
});

describe('Google access-token refresh', () => {
  it('refreshes when the token is expired or about to expire', () => {
    expect(
      googleJwtNeedsRefresh({ accessToken: 'a', expiresAt: 1_000 }, 1_000_000 * 1000)
    ).toBe(true);
    expect(
      googleJwtNeedsRefresh({ accessToken: 'a', expiresAt: 2_000 }, 1_000 * 1000)
    ).toBe(false);
  });

  it('exchanges the refresh token for a new access token', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({ access_token: 'ya29.new', expires_in: 3600 }),
    }));

    const next = await refreshGoogleAccessToken(
      { accessToken: 'old', refreshToken: '1//r', expiresAt: 1 },
      fetchImpl,
      { AUTH_GOOGLE_ID: 'id', AUTH_GOOGLE_SECRET: 'secret' }
    );

    expect(next.accessToken).toBe('ya29.new');
    expect(next.refreshToken).toBe('1//r');
    expect(fetchImpl).toHaveBeenCalledOnce();
  });
});
