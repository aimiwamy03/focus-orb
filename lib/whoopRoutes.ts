import { authSecret, authUrl } from './googleAuth';
import {
  WHOOP_INVITE_ONLY_MESSAGE,
  WHOOP_STATE_COOKIE,
  WHOOP_TOKEN_COOKIE,
  createWhoopState,
  decryptWhoopPayload,
  encryptWhoopPayload,
  isWhoopEmailInvited,
  isWhoopSecure,
  sessionWhoopMatches,
  stateIsValid,
  whoopCookieOptions,
  whoopRedirectUri,
  type WhoopTokenSet,
} from './whoopAuth';
import {
  exchangeWhoopCode,
  revokeWhoopSession,
  summarizeWhoopToday,
  whoopAuthorizeUrl,
  type FetchLike,
  type WhoopClientOptions,
} from './whoopClient';
import { WHOOP_REVOKE_APP_LABEL } from './whoop';
import { isWhoopConfigured as whoopReady, whoopClientId } from './whoopEndpoints';
import type { WhoopEndpoints } from './whoopEndpoints';

export interface WhoopSession {
  email?: string | null;
  userId?: string | null;
}

export interface CookieJar {
  get: (name: string) => { value: string } | undefined;
  set: (
    name: string,
    value: string,
    options?: {
      httpOnly?: boolean;
      sameSite?: 'lax' | 'strict' | 'none';
      secure?: boolean;
      path?: string;
      maxAge?: number;
    }
  ) => void;
  delete: (name: string) => void;
}

export interface WhoopRouteResult {
  status: number;
  redirect?: string;
  body?: Record<string, unknown> | import('./whoop').WhoopCachedSummary;
  cookies?: Array<{ name: string; value: string; clear?: boolean; maxAge?: number }>;
}

function clientOptions(
  env: NodeJS.Dict<string | undefined>,
  fetchImpl?: FetchLike,
  endpoints?: WhoopEndpoints
): WhoopClientOptions {
  return { env, fetchImpl, endpoints };
}

function cookieOpts(env: NodeJS.Dict<string | undefined>, maxAge: number) {
  return whoopCookieOptions(maxAge, isWhoopSecure(env));
}

function sessionOf(session: WhoopSession | null | undefined) {
  return {
    email: session?.email ?? null,
    userId: session?.userId ?? null,
  };
}

export function whoopSessionFromAuth(session: {
  user?: { email?: string | null; id?: string | null } | null;
} | null): WhoopSession {
  return {
    email: session?.user?.email ?? null,
    userId: session?.user?.id ?? null,
  };
}

export function clearWhoopSessionCookies(): WhoopRouteResult {
  return {
    status: 200,
    cookies: [{ name: WHOOP_TOKEN_COOKIE, value: '', clear: true }],
  };
}

export function applyWhoopCookies(jar: CookieJar, result: WhoopRouteResult, env = process.env) {
  for (const cookie of result.cookies ?? []) {
    if (cookie.clear) {
      jar.delete(cookie.name);
      continue;
    }
    jar.set(cookie.name, cookie.value, cookieOpts(env, cookie.maxAge ?? 60 * 60 * 24 * 60));
  }
}

function settingsHome(
  requestUrl: string,
  env: NodeJS.Dict<string | undefined>,
  extra: Record<string, string> = {}
): string {
  const base = (authUrl(env) || new URL(requestUrl).origin).replace(/\/$/, '');
  const url = new URL(`${base}/`);
  url.searchParams.set('settings', '1');
  for (const [key, value] of Object.entries(extra)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}

export function handleWhoopConnect(input: {
  session: WhoopSession | null;
  requestUrl: string;
  env?: NodeJS.Dict<string | undefined>;
}): WhoopRouteResult {
  const env = input.env ?? process.env;
  const session = sessionOf(input.session);
  if (!session.email || !session.userId) {
    return { status: 401, body: { error: 'Sign in with Google first.' } };
  }
  if (!isWhoopEmailInvited(session.email, env)) {
    return { status: 403, body: { error: WHOOP_INVITE_ONLY_MESSAGE } };
  }
  const secret = authSecret(env);
  if (!whoopReady(env) || !whoopClientId(env) || !secret) {
    return { status: 503, body: { error: 'WHOOP is not configured.' } };
  }
  const state = createWhoopState(session.userId, secret);
  const redirectUri = whoopRedirectUri(input.requestUrl, env);
  const location = whoopAuthorizeUrl({
    clientId: whoopClientId(env)!,
    redirectUri,
    state,
  });
  return {
    status: 302,
    redirect: location,
    body: { redirect: location },
    cookies: [{ name: WHOOP_STATE_COOKIE, value: state, maxAge: 10 * 60 }],
  };
}

export async function handleWhoopCallback(input: {
  session: WhoopSession | null;
  requestUrl: string;
  stateCookie: string | undefined;
  env?: NodeJS.Dict<string | undefined>;
  fetchImpl?: FetchLike;
  endpoints?: WhoopEndpoints;
}): Promise<WhoopRouteResult> {
  const env = input.env ?? process.env;
  const secret = authSecret(env);
  const session = sessionOf(input.session);
  const home = settingsHome(input.requestUrl, env);
  const url = new URL(input.requestUrl);
  const state = url.searchParams.get('state');
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');

  const fail = (whoopError?: string): WhoopRouteResult => ({
    status: 302,
    redirect: whoopError ? settingsHome(input.requestUrl, env, { whoopError }) : home,
    cookies: [{ name: WHOOP_STATE_COOKIE, value: '', clear: true }],
  });

  if (!session.email || !session.userId || !secret || error || !code) {
    return fail();
  }
  if (!isWhoopEmailInvited(session.email, env)) {
    return fail('invite');
  }
  if (!stateIsValid(input.stateCookie, state, session.userId, secret)) {
    return fail();
  }

  try {
    const tokens = await exchangeWhoopCode(
      code,
      whoopRedirectUri(input.requestUrl, env),
      clientOptions(env, input.fetchImpl, input.endpoints)
    );
    const payload: WhoopTokenSet = {
      userId: session.userId,
      email: session.email,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt,
    };
    return {
      status: 302,
      redirect: home,
      cookies: [
        { name: WHOOP_STATE_COOKIE, value: '', clear: true },
        {
          name: WHOOP_TOKEN_COOKIE,
          value: encryptWhoopPayload(payload, secret),
          maxAge: 60 * 60 * 24 * 60,
        },
      ],
    };
  } catch {
    return fail();
  }
}

export async function handleWhoopToday(input: {
  session: WhoopSession | null;
  cookie: string | undefined;
  light?: boolean;
  env?: NodeJS.Dict<string | undefined>;
  fetchImpl?: FetchLike;
  endpoints?: WhoopEndpoints;
  nowMs?: number;
}): Promise<WhoopRouteResult> {
  const env = input.env ?? process.env;
  const secret = authSecret(env);
  const session = sessionOf(input.session);
  const clearSession = [{ name: WHOOP_TOKEN_COOKIE, value: '', clear: true }];
  if (!secret) {
    return {
      status: 200,
      body: { connected: false, status: 'disconnected', facts: null },
      cookies: clearSession,
    };
  }
  const tokens = decryptWhoopPayload(input.cookie, secret);
  if (!tokens || !sessionWhoopMatches(tokens, session)) {
    return {
      status: 200,
      body: { connected: false, status: 'disconnected', email: session.email, facts: null },
      cookies: clearSession,
    };
  }
  if (input.light) {
    return {
      status: 200,
      body: {
        connected: true,
        status: 'ok',
        email: tokens.email,
        facts: null,
      },
    };
  }

  let stored = tokens;
  const writeTokens = async (next: WhoopTokenSet) => {
    stored = next;
  };
  const readTokens = async () => stored;

  const { tokens: next, summary } = await summarizeWhoopToday(tokens, {
    ...clientOptions(env, input.fetchImpl, input.endpoints),
    nowMs: input.nowMs,
    readTokens,
    writeTokens,
  });

  return {
    status: 200,
    body: summary,
    cookies: [
      {
        name: WHOOP_TOKEN_COOKIE,
        value: encryptWhoopPayload(next, secret),
        maxAge: 60 * 60 * 24 * 60,
      },
    ],
  };
}

export async function handleWhoopDisconnect(input: {
  session: WhoopSession | null;
  cookie: string | undefined;
  env?: NodeJS.Dict<string | undefined>;
  fetchImpl?: FetchLike;
  endpoints?: WhoopEndpoints;
}): Promise<WhoopRouteResult> {
  const env = input.env ?? process.env;
  const secret = authSecret(env);
  const session = sessionOf(input.session);
  const tokens = secret ? decryptWhoopPayload(input.cookie, secret) : null;
  let revoked = true;
  if (tokens && sessionWhoopMatches(tokens, session)) {
    revoked = await revokeWhoopSession(
      tokens,
      clientOptions(env, input.fetchImpl, input.endpoints)
    );
  }
  return {
    status: 200,
    body: {
      connected: false,
      status: 'disconnected',
      ...(revoked ? {} : { message: WHOOP_REVOKE_APP_LABEL }),
    },
    cookies: [
      { name: WHOOP_TOKEN_COOKIE, value: '', clear: true },
      { name: WHOOP_STATE_COOKIE, value: '', clear: true },
    ],
  };
}
