export const GOOGLE_IDENTITY_SCOPES = 'openid email profile';

export const GOOGLE_CALENDAR_EXTRA_SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.events.readonly',
] as const;

export const GOOGLE_CALENDAR_SCOPES = [
  GOOGLE_IDENTITY_SCOPES,
  ...GOOGLE_CALENDAR_EXTRA_SCOPES,
].join(' ');

export const GOOGLE_IDENTITY_AUTH = {
  scope: GOOGLE_IDENTITY_SCOPES,
  access_type: 'offline',
  prompt: 'consent',
} as const;

export const GOOGLE_CALENDAR_AUTH = {
  scope: GOOGLE_CALENDAR_SCOPES,
  access_type: 'offline',
  prompt: 'consent',
  include_granted_scopes: 'true',
} as const;

export interface GoogleToken {
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  error?: string;
  googleSub?: string;
  sub?: string;
  googleScopes?: string;
  hasCalendar?: boolean;
}

export interface GoogleAccountTokens {
  access_token?: string;
  refresh_token?: string | null;
  expires_at?: number;
  providerAccountId?: string;
  scope?: string;
}

export function googleHasCalendarScope(scope?: string | null): boolean {
  return Boolean(scope?.includes('https://www.googleapis.com/auth/calendar.readonly'));
}

export function sessionHasCalendarAccess(session: {
  accessToken?: string | null;
  hasCalendar?: boolean;
}): boolean {
  if (!session.accessToken) return false;
  if (session.hasCalendar === false) return false;
  return true;
}

export function googleClientId(
  env: NodeJS.Dict<string | undefined> = process.env
): string | undefined {
  return env.AUTH_GOOGLE_ID ?? env.GOOGLE_CLIENT_ID;
}

export function googleClientSecret(
  env: NodeJS.Dict<string | undefined> = process.env
): string | undefined {
  return env.AUTH_GOOGLE_SECRET ?? env.GOOGLE_CLIENT_SECRET;
}

export function authSecret(
  env: NodeJS.Dict<string | undefined> = process.env
): string | undefined {
  return env.AUTH_SECRET ?? env.NEXTAUTH_SECRET;
}

export function authUrl(
  env: NodeJS.Dict<string | undefined> = process.env
): string | undefined {
  return env.AUTH_URL ?? env.NEXTAUTH_URL;
}

export function isGoogleAuthConfigured(
  env: NodeJS.Dict<string | undefined> = process.env
): boolean {
  return Boolean(googleClientId(env) && googleClientSecret(env) && authSecret(env));
}

/** NextAuth 500s with no AUTH_SECRET. Return an empty session instead. */
export function unconfiguredSessionBody(): null {
  return null;
}

export function applyGoogleAccountToToken(
  token: GoogleToken,
  account: GoogleAccountTokens | null | undefined
): GoogleToken {
  let next = token;
  if (account?.providerAccountId) {
    next = { ...next, googleSub: account.providerAccountId };
  }
  if (account?.scope != null) {
    next = {
      ...next,
      googleScopes: account.scope,
      hasCalendar: googleHasCalendarScope(account.scope),
    };
  }
  if (!account?.access_token) return next;
  return {
    ...next,
    accessToken: account.access_token,
    refreshToken: account.refresh_token || next.refreshToken,
    expiresAt: account.expires_at,
    error: undefined,
  };
}

export function attachGoogleAccessToSession<
  T extends { user?: { id?: string | null; email?: string | null; name?: string | null } | null },
>(session: T, token: GoogleToken): T & { accessToken?: string; hasCalendar?: boolean } {
  const id = token.googleSub ?? token.sub;
  const user = session.user ? { ...session.user, id: id ?? session.user.id } : session.user;
  return Object.assign(session, {
    accessToken: token.accessToken,
    hasCalendar: token.hasCalendar,
    user,
  });
}

export function googleJwtNeedsRefresh(
  token: GoogleToken,
  nowMs: number = Date.now()
): boolean {
  if (!token.accessToken) return Boolean(token.refreshToken);
  if (typeof token.expiresAt !== 'number') return false;
  return nowMs >= token.expiresAt * 1000 - 60_000;
}

type FetchLike = (
  input: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string }
) => Promise<{ ok: boolean; json: () => Promise<unknown> }>;

export async function refreshGoogleAccessToken(
  token: GoogleToken,
  fetchImpl: FetchLike = fetch,
  env: NodeJS.Dict<string | undefined> = process.env
): Promise<GoogleToken> {
  const clientId = googleClientId(env);
  const clientSecret = googleClientSecret(env);
  if (!token.refreshToken || !clientId || !clientSecret) {
    return { ...token, error: 'RefreshAccessTokenError' };
  }

  const response = await fetchImpl('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: token.refreshToken,
    }).toString(),
  });

  if (!response.ok) {
    return { ...token, accessToken: undefined, error: 'RefreshAccessTokenError' };
  }

  const data = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
    refresh_token?: string;
  };

  if (!data.access_token) {
    return { ...token, accessToken: undefined, error: 'RefreshAccessTokenError' };
  }

  return {
    ...token,
    accessToken: data.access_token,
    expiresAt: Math.floor(Date.now() / 1000) + (data.expires_in ?? 3600),
    refreshToken: data.refresh_token || token.refreshToken,
    error: undefined,
  };
}
