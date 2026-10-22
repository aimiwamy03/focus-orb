import { recoveryStateFromWhoop, WHOOP_SCOPES } from './whoop';
import {
  WHOOP_ENDPOINTS,
  isWhoopConfigured,
  whoopClientId,
  whoopClientSecret,
  type WhoopEndpoints,
} from './whoopEndpoints';
import {
  decryptWhoopPayload,
  encryptWhoopPayload,
  whoopNeedsRefresh,
  type WhoopTokenSet,
} from './whoopAuth';
import {
  type WhoopCachedSummary,
  type WhoopConnectionStatus,
  type WhoopFacts,
} from './whoop';

export type FetchLike = (
  input: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    signal?: AbortSignal;
  }
) => Promise<{
  ok: boolean;
  status: number;
  headers: { get: (name: string) => string | null };
  json: () => Promise<unknown>;
  text: () => Promise<string>;
}>;

export interface WhoopClientOptions {
  fetchImpl?: FetchLike;
  env?: NodeJS.Dict<string | undefined>;
  endpoints?: WhoopEndpoints;
  nowMs?: number;
  timeoutMs?: number;
}

const inflightRefresh = new Map<string, Promise<WhoopTokenSet>>();

function endpointsOf(options: WhoopClientOptions): WhoopEndpoints {
  return options.endpoints ?? WHOOP_ENDPOINTS;
}

function envOf(options: WhoopClientOptions): NodeJS.Dict<string | undefined> {
  return options.env ?? process.env;
}

function fetchOf(options: WhoopClientOptions): FetchLike {
  return options.fetchImpl ?? (fetch as unknown as FetchLike);
}

function timeoutMs(options: WhoopClientOptions): number {
  return options.timeoutMs ?? 8000;
}

class WhoopHttpError extends Error {
  status: number;
  retryAfterMs: number | null;
  constructor(status: number, message: string, retryAfterMs: number | null = null) {
    super(message);
    this.status = status;
    this.retryAfterMs = retryAfterMs;
  }
}

function retryAfterMs(headers: { get: (name: string) => string | null }): number | null {
  const raw = headers.get('retry-after') ?? headers.get('Retry-After');
  if (!raw) return null;
  const seconds = Number(raw);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const when = Date.parse(raw);
  if (Number.isFinite(when)) return Math.max(0, when - Date.now());
  return null;
}

async function whoopFetch(
  url: string,
  init: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  },
  options: WhoopClientOptions
): Promise<{ status: number; body: unknown; headers: { get: (name: string) => string | null } }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs(options));
  try {
    const response = await fetchOf(options)(url, { ...init, signal: controller.signal });
    let body: unknown = null;
    try {
      body = await response.json();
    } catch {
      body = null;
    }
    if (response.status === 429) {
      throw new WhoopHttpError(429, 'rate limited', retryAfterMs(response.headers));
    }
    if (!response.ok) {
      throw new WhoopHttpError(response.status, 'whoop request failed');
    }
    return { status: response.status, body, headers: response.headers };
  } catch (error) {
    if (error instanceof WhoopHttpError) throw error;
    throw new WhoopHttpError(0, 'timeout');
  } finally {
    clearTimeout(timer);
  }
}

export function whoopAuthorizeUrl(input: {
  clientId: string;
  redirectUri: string;
  state: string;
  endpoints?: WhoopEndpoints;
}): string {
  const auth = input.endpoints?.auth ?? WHOOP_ENDPOINTS.auth;
  const params = new URLSearchParams({
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
    response_type: 'code',
    scope: WHOOP_SCOPES,
    state: input.state,
  });
  return `${auth}?${params.toString()}`;
}

export async function exchangeWhoopCode(
  code: string,
  redirectUri: string,
  options: WhoopClientOptions = {}
): Promise<{ accessToken: string; refreshToken: string; expiresAt: number }> {
  const env = envOf(options);
  const clientId = whoopClientId(env);
  const clientSecret = whoopClientSecret(env);
  if (!clientId || !clientSecret) throw new Error('WHOOP is not configured');
  const response = await whoopFetch(
    endpointsOf(options).token,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        client_secret: clientSecret,
      }).toString(),
    },
    options
  );
  const data = response.body as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };
  if (!data.access_token || !data.refresh_token) {
    throw new Error('WHOOP token response missing tokens');
  }
  const now = options.nowMs ?? Date.now();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: now + (data.expires_in ?? 3600) * 1000,
  };
}

async function refreshWhoopTokensOnce(
  tokens: WhoopTokenSet,
  options: WhoopClientOptions
): Promise<WhoopTokenSet> {
  const env = envOf(options);
  const clientId = whoopClientId(env);
  const clientSecret = whoopClientSecret(env);
  if (!clientId || !clientSecret) throw new Error('WHOOP is not configured');
  const response = await whoopFetch(
    endpointsOf(options).token,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: tokens.refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
        scope: 'offline',
      }).toString(),
    },
    options
  );
  const data = response.body as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };
  if (!data.access_token || !data.refresh_token) {
    throw new Error('WHOOP refresh missing tokens');
  }
  const now = options.nowMs ?? Date.now();
  return {
    ...tokens,
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: now + (data.expires_in ?? 3600) * 1000,
  };
}

export type ReadTokens = () => Promise<WhoopTokenSet | null>;
export type WriteTokens = (tokens: WhoopTokenSet) => Promise<void>;

export async function refreshWhoopTokens(
  tokens: WhoopTokenSet,
  options: WhoopClientOptions & { readTokens?: ReadTokens; writeTokens?: WriteTokens } = {}
): Promise<WhoopTokenSet> {
  const key = tokens.email.toLowerCase();
  const existing = inflightRefresh.get(key);
  if (existing) return existing;

  const run = (async () => {
    try {
      const next = await refreshWhoopTokensOnce(tokens, options);
      await options.writeTokens?.(next);
      return next;
    } catch (firstError) {
      const latest = (await options.readTokens?.()) ?? tokens;
      if (latest.refreshToken !== tokens.refreshToken) {
        return latest;
      }
      try {
        const retried = await refreshWhoopTokensOnce(latest, options);
        await options.writeTokens?.(retried);
        return retried;
      } catch {
        throw firstError;
      }
    }
  })();

  inflightRefresh.set(key, run);
  try {
    return await run;
  } finally {
    inflightRefresh.delete(key);
  }
}

export async function revokeWhoopToken(
  token: string,
  options: WhoopClientOptions = {}
): Promise<void> {
  const env = envOf(options);
  const clientId = whoopClientId(env);
  const clientSecret = whoopClientSecret(env);
  if (!clientId || !clientSecret) return;
  try {
    await whoopFetch(
      endpointsOf(options).revoke,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          token,
        }).toString(),
      },
      options
    );
  } catch {
    // Disconnect still succeeds locally if WHOOP is down.
  }
}

interface WhoopList<T> {
  records?: T[];
}

interface WhoopRecoveryRecord {
  score_state?: string;
  score?: {
    user_calibrating?: boolean;
    recovery_score?: number;
  } | null;
}

interface WhoopSleepRecord {
  nap?: boolean;
  score_state?: string;
  score?: {
    sleep_performance_percentage?: number;
    sleep_needed?: { need_from_sleep_debt_milli?: number };
  } | null;
  end?: string | null;
}

interface WhoopCycleRecord {
  start?: string;
  end?: string | null;
  score?: { strain?: number } | null;
}

interface WhoopWorkoutRecord {
  start?: string;
  end?: string | null;
}

async function getRecords<T>(
  path: string,
  accessToken: string,
  options: WhoopClientOptions,
  query: Record<string, string> = {}
): Promise<T[]> {
  const url = new URL(`${endpointsOf(options).api}${path}`);
  url.searchParams.set('limit', query.limit ?? '10');
  for (const [key, value] of Object.entries(query)) {
    if (key === 'limit') continue;
    url.searchParams.set(key, value);
  }
  const response = await whoopFetch(
    url.toString(),
    { headers: { Authorization: `Bearer ${accessToken}` } },
    options
  );
  const body = response.body as WhoopList<T>;
  return Array.isArray(body?.records) ? body.records : [];
}

export function factsFromWhoopPayloads(input: {
  recoveries: WhoopRecoveryRecord[];
  sleeps: WhoopSleepRecord[];
  cycles: WhoopCycleRecord[];
  workouts: WhoopWorkoutRecord[];
  nowMs: number;
}): WhoopFacts {
  const recovery = input.recoveries[0];
  const calibrating = Boolean(recovery?.score?.user_calibrating);
  const recoveryState = recoveryStateFromWhoop(recovery?.score_state, calibrating);
  const sleep = input.sleeps.find((item) => !item.nap);
  const currentCycle = input.cycles[0];
  const previousCycle = input.cycles[1];
  const latestWorkoutEnd = input.workouts
    .map((item) => (item.end ? Date.parse(item.end) : NaN))
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => b - a)[0];

  return {
    recovery:
      recoveryState === 'scored' && typeof recovery?.score?.recovery_score === 'number'
        ? recovery.score.recovery_score
        : null,
    recoveryState,
    sleepPerformance:
      typeof sleep?.score?.sleep_performance_percentage === 'number'
        ? sleep.score.sleep_performance_percentage
        : null,
    sleepDebtMinutes:
      typeof sleep?.score?.sleep_needed?.need_from_sleep_debt_milli === 'number'
        ? sleep.score.sleep_needed.need_from_sleep_debt_milli / 60_000
        : null,
    yesterdayStrain:
      typeof previousCycle?.score?.strain === 'number' ? previousCycle.score.strain : null,
    lastWorkoutEndedAt: latestWorkoutEnd ?? null,
    wakeAt: currentCycle?.start ? Date.parse(currentCycle.start) : null,
    now: input.nowMs,
  };
}

export function connectionStatusFromFacts(facts: WhoopFacts): WhoopConnectionStatus {
  if (facts.recoveryState === 'calibrating') return 'calibrating';
  if (facts.recoveryState === 'pending') return 'pending';
  if (facts.recoveryState === 'unscorable' || facts.recoveryState === 'missing') {
    if (
      facts.sleepPerformance == null &&
      facts.yesterdayStrain == null &&
      facts.lastWorkoutEndedAt == null
    ) {
      return 'no-data';
    }
  }
  return 'ok';
}

export async function fetchWhoopFacts(
  accessToken: string,
  options: WhoopClientOptions = {}
): Promise<WhoopFacts> {
  const nowMs = options.nowMs ?? Date.now();
  const [recoveries, sleeps, cycles, workouts] = await Promise.all([
    getRecords<WhoopRecoveryRecord>('/recovery', accessToken, options, { limit: '1' }),
    getRecords<WhoopSleepRecord>('/activity/sleep', accessToken, options, { limit: '5' }),
    getRecords<WhoopCycleRecord>('/cycle', accessToken, options, { limit: '2' }),
    getRecords<WhoopWorkoutRecord>('/activity/workout', accessToken, options, { limit: '5' }),
  ]);
  return factsFromWhoopPayloads({ recoveries, sleeps, cycles, workouts, nowMs });
}

export async function summarizeWhoopToday(
  tokens: WhoopTokenSet,
  options: WhoopClientOptions & { readTokens?: ReadTokens; writeTokens?: WriteTokens } = {}
): Promise<{ tokens: WhoopTokenSet; summary: WhoopCachedSummary }> {
  const nowMs = options.nowMs ?? Date.now();
  let current = tokens;
  if (whoopNeedsRefresh(current, nowMs)) {
    current = await refreshWhoopTokens(current, options);
  }

  try {
    const facts = await fetchWhoopFacts(current.accessToken, { ...options, nowMs });
    const summary: WhoopCachedSummary = {
      connected: true,
      email: current.email,
      status: connectionStatusFromFacts(facts),
      facts,
      fetchedAt: nowMs,
    };
    current = { ...current, summary };
    await options.writeTokens?.(current);
    return { tokens: current, summary };
  } catch (error) {
    if (current.summary) {
      return { tokens: current, summary: { ...current.summary, fetchedAt: current.summary.fetchedAt } };
    }
    const status = error instanceof WhoopHttpError && error.status === 429 ? 'error' : 'error';
    return {
      tokens: current,
      summary: {
        connected: true,
        email: current.email,
        status,
        facts: null,
        fetchedAt: nowMs,
      },
    };
  }
}

export function serializeWhoopCookie(tokens: WhoopTokenSet, secret: string): string {
  return encryptWhoopPayload(tokens, secret);
}

export function parseWhoopCookie(value: string | undefined, secret: string): WhoopTokenSet | null {
  return decryptWhoopPayload(value, secret);
}

export { isWhoopConfigured };
