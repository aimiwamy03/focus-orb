export const GOOGLE_CALENDAR_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.events.readonly',
].join(' ');

export interface GoogleToken {
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  error?: string;
}

export interface GoogleAccountTokens {
  access_token?: string;
  refresh_token?: string | null;
  expires_at?: number;
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

export function applyGoogleAccountToToken(
  token: GoogleToken,
  account: GoogleAccountTokens | null | undefined
): GoogleToken {
  if (!account?.access_token) return token;
  return {
    ...token,
    accessToken: account.access_token,
    refreshToken: account.refresh_token || token.refreshToken,
    expiresAt: account.expires_at,
    error: undefined,
  };
}

export function attachGoogleAccessToSession<T extends object>(
  session: T,
  token: GoogleToken
): T & { accessToken?: string } {
  return Object.assign(session, { accessToken: token.accessToken });
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
