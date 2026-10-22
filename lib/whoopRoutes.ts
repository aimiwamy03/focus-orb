import { authSecret, authUrl } from './googleAuth';
import {
  WHOOP_STATE_COOKIE,
  WHOOP_TOKEN_COOKIE,
  createWhoopState,
  decryptWhoopPayload,
  encryptWhoopPayload,
  isWhoopSecure,
  sessionEmailMatches,
  stateIsValid,
  whoopCookieOptions,
  whoopRedirectUri,
  type WhoopTokenSet,
} from './whoopAuth';
import {
  exchangeWhoopCode,
  revokeWhoopToken,
  summarizeWhoopToday,
  whoopAuthorizeUrl,
  type FetchLike,
  type WhoopClientOptions,
} from './whoopClient';
import { isWhoopConfigured as whoopReady, whoopClientId } from './whoopEndpoints';
import type { WhoopEndpoints } from './whoopEndpoints';

export interface WhoopSession {
  email?: string | null;
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

export function applyWhoopCookies(jar: CookieJar, result: WhoopRouteResult, env = process.env) {
  for (const cookie of result.cookies ?? []) {
    if (cookie.clear) {
      jar.delete(cookie.name);
      continue;
    }
    jar.set(cookie.name, cookie.value, cookieOpts(env, cookie.maxAge ?? 60 * 60 * 24 * 60));
  }
}

export function handleWhoopConnect(input: {
  session: WhoopSession | null;
  requestUrl: string;
  env?: NodeJS.Dict<string | undefined>;
}): WhoopRouteResult {
  const env = input.env ?? process.env;
  const email = input.session?.email;
  if (!email) {
    return { status: 401, body: { error: 'Sign in with Google first.' } };
  }
  if (!whoopReady(env) || !whoopClientId(env)) {
    return { status: 503, body: { error: 'WHOOP is not configured.' } };
  }
  const state = createWhoopState();
  const redirectUri = whoopRedirectUri(input.requestUrl, env);
  const location = whoopAuthorizeUrl({
    clientId: whoopClientId(env)!,
    redirectUri,
    state,
  });
  return {
    status: 302,
    redirect: location,
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
  const email = input.session?.email;
  const home = (authUrl(env) || new URL(input.requestUrl).origin).replace(/\/$/, '') + '/?settings=1';
  const url = new URL(input.requestUrl);
  const state = url.searchParams.get('state');
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');

  const fail = (): WhoopRouteResult => ({
    status: 302,
    redirect: home,
    cookies: [{ name: WHOOP_STATE_COOKIE, value: '', clear: true }],
  });

  if (!email || !secret || error || !code || !stateIsValid(input.stateCookie, state)) {
    return fail();
  }

  try {
    const tokens = await exchangeWhoopCode(
      code,
      whoopRedirectUri(input.requestUrl, env),
      clientOptions(env, input.fetchImpl, input.endpoints)
    );
    const payload: WhoopTokenSet = {
      email,
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
  const email = input.session?.email ?? null;
  if (!secret) {
    return { status: 200, body: { connected: false, status: 'disconnected', facts: null } };
  }
  const tokens = decryptWhoopPayload(input.cookie, secret);
  if (!tokens || !sessionEmailMatches(tokens, email)) {
    return { status: 200, body: { connected: false, status: 'disconnected', email, facts: null } };
  }
  if (input.light) {
    return {
      status: 200,
      body: {
        connected: true,
        status: tokens.summary?.status ?? 'ok',
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
  const tokens = secret ? decryptWhoopPayload(input.cookie, secret) : null;
  if (tokens && sessionEmailMatches(tokens, input.session?.email)) {
    await revokeWhoopToken(tokens.refreshToken, clientOptions(env, input.fetchImpl, input.endpoints));
    await revokeWhoopToken(tokens.accessToken, clientOptions(env, input.fetchImpl, input.endpoints));
  }
  return {
    status: 200,
    body: { connected: false, status: 'disconnected' },
    cookies: [
      { name: WHOOP_TOKEN_COOKIE, value: '', clear: true },
      { name: WHOOP_STATE_COOKIE, value: '', clear: true },
    ],
  };
}

