import { describe, expect, it } from 'vitest';
import { WHOOP_ENDPOINTS, type WhoopEndpoints } from './whoopEndpoints';
import {
  exchangeWhoopCode,
  factsFromWhoopPayloads,
  refreshWhoopTokens,
  revokeWhoopSession,
  revokeWhoopToken,
  summarizeWhoopToday,
  type FetchLike,
} from './whoopClient';
import {
  createWhoopState,
  encryptWhoopPayload,
  whoopNeedsRefresh,
  type WhoopTokenSet,
} from './whoopAuth';
import {
  handleWhoopCallback,
  handleWhoopConnect,
  handleWhoopDisconnect,
  handleWhoopToday,
} from './whoopRoutes';
import { WHOOP_INVITE_ONLY_MESSAGE, WHOOP_RECONNECT_LABEL, WHOOP_REVOKE_APP_LABEL } from './whoop';

const ENV = {
  WHOOP_CLIENT_ID: 'whoop-id',
  WHOOP_CLIENT_SECRET: 'whoop-secret',
  AUTH_SECRET: 'test-nextauth-secret-value',
  NEXTAUTH_URL: 'http://localhost:3000',
  WHOOP_INVITE_EMAILS: 'amy@example.com',
};

const ENDPOINTS: WhoopEndpoints = {
  auth: 'https://whoop.test/oauth/oauth2/auth',
  token: 'https://whoop.test/oauth/oauth2/token',
  revoke: 'https://whoop.test/oauth/oauth2/revoke',
  api: 'https://whoop.test/developer/v2',
};

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name: string) => headers[name.toLowerCase()] ?? headers[name] ?? null },
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

class FakeWhoop {
  access = 'access-1';
  refresh = 'refresh-1';
  expiresIn = 3600;
  refreshCalls = 0;
  revokeCalls: string[] = [];
  failRefresh = 0;
  failRevoke = 0;
  statusByPath = new Map<string, number>();
  recoveries: unknown[] = [
    {
      score_state: 'SCORED',
      score: { user_calibrating: false, recovery_score: 82 },
    },
  ];
  sleeps: unknown[] = [
    {
      nap: false,
      score_state: 'SCORED',
      score: {
        sleep_performance_percentage: 90,
        sleep_needed: { need_from_sleep_debt_milli: 0 },
        stage_summary: {
          total_light_sleep_time_milli: 3 * 60 * 60 * 1000,
          total_slow_wave_sleep_time_milli: 90 * 60 * 1000,
          total_rem_sleep_time_milli: 70 * 60 * 1000,
        },
      },
    },
    {
      nap: true,
      score_state: 'SCORED',
      score: { sleep_performance_percentage: 10 },
    },
  ];
  cycles: unknown[] = [
    { start: '2026-10-22T08:00:00.000Z', end: null, score: { strain: 9 } },
    { start: '2026-10-21T07:30:00.000Z', end: '2026-10-22T08:00:00.000Z', score: { strain: 11 } },
  ];
  workouts: unknown[] = [];

  fetch: FetchLike = async (input, init) => {
    const url = new URL(input);
    const path = url.origin + url.pathname;
    const forced = [...this.statusByPath.entries()].find(([key]) => path.includes(key));
    if (forced && forced[1] === 429) {
      return jsonResponse(429, { error: 'rate' }, { 'retry-after': '30' });
    }
    if (path === ENDPOINTS.token) {
      const body = new URLSearchParams(init?.body ?? '');
      if (body.get('grant_type') === 'refresh_token') {
        this.refreshCalls += 1;
        if (this.failRefresh > 0) {
          this.failRefresh -= 1;
          return jsonResponse(400, { error: 'invalid' });
        }
        this.access = `access-${this.refreshCalls + 1}`;
        this.refresh = `refresh-${this.refreshCalls + 1}`;
        return jsonResponse(200, {
          access_token: this.access,
          refresh_token: this.refresh,
          expires_in: this.expiresIn,
        });
      }
      return jsonResponse(200, {
        access_token: this.access,
        refresh_token: this.refresh,
        expires_in: this.expiresIn,
      });
    }
    if (path === ENDPOINTS.revoke) {
      const body = new URLSearchParams(init?.body ?? '');
      this.revokeCalls.push(body.get('token') ?? '');
      if (this.failRevoke > 0) {
        this.failRevoke -= 1;
        return jsonResponse(401, { error: 'expired' });
      }
      return jsonResponse(200, {});
    }
    if (path.endsWith('/recovery')) return jsonResponse(200, { records: this.recoveries });
    if (path.endsWith('/activity/sleep')) return jsonResponse(200, { records: this.sleeps });
    if (path.endsWith('/cycle')) return jsonResponse(200, { records: this.cycles });
    if (path.endsWith('/activity/workout')) return jsonResponse(200, { records: this.workouts });
    return jsonResponse(404, {});
  };
}

function tokens(partial: Partial<WhoopTokenSet> = {}): WhoopTokenSet {
  return {
    userId: 'sub-amy',
    email: 'amy@example.com',
    accessToken: 'access-1',
    refreshToken: 'refresh-1',
    expiresAt: Date.now() + 3600_000,
    ...partial,
  };
}

const AMY = { email: 'amy@example.com', userId: 'sub-amy' };

describe('WHOOP payload mapping', () => {
  it('ignores naps and maps pending, unscorable, and calibrating', () => {
    const now = Date.parse('2026-10-22T12:00:00Z');
    const pending = factsFromWhoopPayloads({
      recoveries: [{ score_state: 'PENDING_SCORE', score: null }],
      sleeps: [{ nap: true, score: { sleep_performance_percentage: 12 } }],
      cycles: [],
      workouts: [],
      nowMs: now,
    });
    expect(pending.recoveryState).toBe('pending');
    expect(pending.sleepPerformance).toBeNull();
    expect(pending.sleepMinutes).toBeNull();

    const calibrating = factsFromWhoopPayloads({
      recoveries: [
        { score_state: 'SCORED', score: { user_calibrating: true, recovery_score: 40 } },
      ],
      sleeps: [],
      cycles: [],
      workouts: [],
      nowMs: now,
    });
    expect(calibrating.recoveryState).toBe('calibrating');

    const missing = factsFromWhoopPayloads({
      recoveries: [{ score_state: 'UNSCORABLE', score: null }],
      sleeps: [],
      cycles: [],
      workouts: [],
      nowMs: now,
    });
    expect(missing.recoveryState).toBe('unscorable');
    expect(missing.recovery).toBeNull();
    expect(missing.sleepMinutes).toBeNull();

    const slept = factsFromWhoopPayloads({
      recoveries: [{ score_state: 'SCORED', score: { recovery_score: 42 } }],
      sleeps: [
        {
          nap: false,
          score: {
            sleep_performance_percentage: 72,
            stage_summary: {
              total_light_sleep_time_milli: 3 * 60 * 60 * 1000,
              total_slow_wave_sleep_time_milli: 90 * 60 * 1000,
              total_rem_sleep_time_milli: 80 * 60 * 1000,
            },
          },
        },
      ],
      cycles: [],
      workouts: [],
      nowMs: now,
    });
    expect(slept.sleepMinutes).toBe(350);
    expect(slept.sleepPerformance).toBe(72);
  });
});

describe('WHOOP fake server', () => {
  it('exchanges a code and refreshes when the access token is almost expired', async () => {
    const whoop = new FakeWhoop();
    const exchanged = await exchangeWhoopCode('code-1', 'http://localhost:3000/api/whoop/callback', {
      fetchImpl: whoop.fetch,
      env: ENV,
      endpoints: ENDPOINTS,
      nowMs: 1_000,
    });
    expect(exchanged.accessToken).toBe('access-1');

    const soon = tokens({ expiresAt: 1_000 + 60_000 });
    expect(whoopNeedsRefresh(soon, 1_000)).toBe(true);
    const refreshed = await refreshWhoopTokens(soon, {
      fetchImpl: whoop.fetch,
      env: ENV,
      endpoints: ENDPOINTS,
      nowMs: 1_000,
    });
    expect(refreshed.accessToken).toBe('access-2');
    expect(refreshed.refreshToken).toBe('refresh-2');
    expect(whoop.refreshCalls).toBe(1);
  });

  it('retries once after re-reading a cookie that another tab already refreshed', async () => {
    const whoop = new FakeWhoop();
    whoop.failRefresh = 1;
    let stored = tokens();
    const result = await refreshWhoopTokens(stored, {
      fetchImpl: whoop.fetch,
      env: ENV,
      endpoints: ENDPOINTS,
      readTokens: async () => {
        stored = tokens({ accessToken: 'from-other-tab', refreshToken: 'refresh-other' });
        return stored;
      },
    });
    expect(result.refreshToken).toBe('refresh-other');
    expect(whoop.refreshCalls).toBe(1);
  });

  it('retries the refresh once when the cookie is still stale', async () => {
    const whoop = new FakeWhoop();
    whoop.failRefresh = 1;
    const stored = tokens();
    const result = await refreshWhoopTokens(stored, {
      fetchImpl: whoop.fetch,
      env: ENV,
      endpoints: ENDPOINTS,
      readTokens: async () => stored,
    });
    expect(whoop.refreshCalls).toBe(2);
    expect(result.accessToken).toBe('access-3');
  });

  it('keeps the last summary on 429', async () => {
    const whoop = new FakeWhoop();
    const last = {
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
      },
      fetchedAt: 5,
    };
    whoop.statusByPath.set('/recovery', 429);
    const { summary } = await summarizeWhoopToday(tokens({ summary: last }), {
      fetchImpl: whoop.fetch,
      env: ENV,
      endpoints: ENDPOINTS,
      nowMs: Date.parse('2026-10-22T12:00:00Z'),
    });
    expect(summary.facts?.recovery).toBe(82);
    expect(summary.fetchedAt).toBe(5);
  });

  it('treats PENDING_SCORE as pending without changing numbers', async () => {
    const whoop = new FakeWhoop();
    whoop.recoveries = [{ score_state: 'PENDING_SCORE', score: null }];
    const { summary } = await summarizeWhoopToday(tokens(), {
      fetchImpl: whoop.fetch,
      env: ENV,
      endpoints: ENDPOINTS,
      nowMs: Date.parse('2026-10-22T12:00:00Z'),
    });
    expect(summary.status).toBe('pending');
    expect(summary.facts?.recovery).toBeNull();
  });

  it('revokes even when WHOOP is down, and deletes the cookie', async () => {
    const whoop = new FakeWhoop();
    whoop.statusByPath.set('/oauth/oauth2/revoke', 500);
    await revokeWhoopToken('refresh-1', {
      fetchImpl: async () => {
        throw new Error('down');
      },
      env: ENV,
      endpoints: ENDPOINTS,
    });
    const sealed = encryptWhoopPayload(tokens(), ENV.AUTH_SECRET);
    const result = await handleWhoopDisconnect({
      session: AMY,
      cookie: sealed,
      env: ENV,
      fetchImpl: whoop.fetch,
      endpoints: ENDPOINTS,
    });
    expect(result.body).toMatchObject({ connected: false, status: 'disconnected' });
    expect(result.cookies?.some((cookie) => cookie.name === 'whoop_session' && cookie.clear)).toBe(
      true
    );
  });

  it('refreshes an expired token then revokes, or asks to remove the app', async () => {
    const expired = new FakeWhoop();
    expired.failRevoke = 2;
    const first = await revokeWhoopSession(tokens(), {
      fetchImpl: expired.fetch,
      env: ENV,
      endpoints: ENDPOINTS,
    });
    expect(first).toBe(true);
    expect(expired.refreshCalls).toBe(1);
    expect(expired.revokeCalls.length).toBeGreaterThan(2);

    const stuck = new FakeWhoop();
    stuck.failRevoke = 99;
    stuck.failRefresh = 99;
    const failed = await handleWhoopDisconnect({
      session: AMY,
      cookie: encryptWhoopPayload(tokens(), ENV.AUTH_SECRET),
      env: ENV,
      fetchImpl: stuck.fetch,
      endpoints: ENDPOINTS,
    });
    expect(failed.body).toMatchObject({
      connected: false,
      status: 'disconnected',
      message: WHOOP_REVOKE_APP_LABEL,
    });
    expect(failed.cookies?.some((cookie) => cookie.name === 'whoop_session' && cookie.clear)).toBe(
      true
    );
  });

  it('asks to reconnect WHOOP after a refresh token rotation miss', async () => {
    const whoop = new FakeWhoop();
    whoop.failRefresh = 99;
    const { summary } = await summarizeWhoopToday(tokens({ expiresAt: 1_000 }), {
      fetchImpl: whoop.fetch,
      env: ENV,
      endpoints: ENDPOINTS,
      nowMs: 1_000,
    });
    expect(summary.status).toBe('reconnect');
    expect(summary.message).toBe(WHOOP_RECONNECT_LABEL);
    expect(summary.connected).toBe(false);
  });

  it('rejects a callback when the state cookie does not match', async () => {
    const whoop = new FakeWhoop();
    const state = createWhoopState('sub-amy', ENV.AUTH_SECRET);
    const result = await handleWhoopCallback({
      session: AMY,
      requestUrl: `http://localhost:3000/api/whoop/callback?code=x&state=${state}`,
      stateCookie: createWhoopState('sub-amy', ENV.AUTH_SECRET),
      env: ENV,
      fetchImpl: whoop.fetch,
      endpoints: ENDPOINTS,
    });
    expect(result.redirect).toContain('settings=1');
    expect(result.cookies?.some((cookie) => cookie.name === 'whoop_session')).toBeFalsy();
  });

  it('saves tokens on a valid callback and rejects a different Google sub', async () => {
    const whoop = new FakeWhoop();
    const state = createWhoopState('sub-amy', ENV.AUTH_SECRET);
    const callback = await handleWhoopCallback({
      session: AMY,
      requestUrl: `http://localhost:3000/api/whoop/callback?code=ok&state=${state}`,
      stateCookie: state,
      env: ENV,
      fetchImpl: whoop.fetch,
      endpoints: ENDPOINTS,
    });
    const cookie = callback.cookies?.find((item) => item.name === 'whoop_session')?.value;
    expect(cookie).toBeTruthy();

    const otherEmail = await handleWhoopToday({
      session: { userId: 'sub-amy', email: 'other@example.com' },
      cookie,
      env: ENV,
      fetchImpl: whoop.fetch,
      endpoints: ENDPOINTS,
    });
    expect(otherEmail.body).toMatchObject({ connected: false, status: 'disconnected' });
    expect(otherEmail.cookies?.some((item) => item.name === 'whoop_session' && item.clear)).toBe(
      true
    );

    const otherSub = await handleWhoopToday({
      session: { userId: 'sub-b', email: 'amy@example.com' },
      cookie,
      env: ENV,
      fetchImpl: whoop.fetch,
      endpoints: ENDPOINTS,
    });
    expect(otherSub.body).toMatchObject({ connected: false, status: 'disconnected' });
    expect(otherSub.cookies?.some((item) => item.name === 'whoop_session' && item.clear)).toBe(true);

    const mine = await handleWhoopToday({
      session: AMY,
      cookie,
      env: ENV,
      fetchImpl: whoop.fetch,
      endpoints: ENDPOINTS,
      nowMs: Date.parse('2026-10-22T12:00:00Z'),
    });
    expect(mine.body).toMatchObject({ connected: true, status: 'ok' });
    expect((mine.body as { facts: { recovery: number } }).facts.recovery).toBe(82);
    const setCookie = mine.cookies?.find((item) => item.name === 'whoop_session')?.value ?? '';
    expect(setCookie).not.toContain('recovery');
  });

  it('refuses connect and callback when the email is not invited', async () => {
    const whoop = new FakeWhoop();
    const empty = handleWhoopConnect({
      session: AMY,
      requestUrl: 'http://localhost:3000/api/whoop/connect',
      env: { ...ENV, WHOOP_INVITE_EMAILS: '' },
    });
    expect(empty).toMatchObject({
      status: 403,
      body: { error: WHOOP_INVITE_ONLY_MESSAGE },
    });

    const other = handleWhoopConnect({
      session: AMY,
      requestUrl: 'http://localhost:3000/api/whoop/connect',
      env: { ...ENV, WHOOP_INVITE_EMAILS: 'other@example.com' },
    });
    expect(other.status).toBe(403);

    const state = createWhoopState('sub-amy', ENV.AUTH_SECRET);
    const callback = await handleWhoopCallback({
      session: AMY,
      requestUrl: `http://localhost:3000/api/whoop/callback?code=ok&state=${state}`,
      stateCookie: state,
      env: { ...ENV, WHOOP_INVITE_EMAILS: 'other@example.com' },
      fetchImpl: whoop.fetch,
      endpoints: ENDPOINTS,
    });
    expect(callback.redirect).toContain('whoopError=invite');
    expect(callback.cookies?.some((item) => item.name === 'whoop_session')).toBeFalsy();
  });

  it('sets private no-store on WHOOP responses', async () => {
    const { whoopResponse } = await import('./whoopHttp');
    const response = whoopResponse({
      status: 200,
      body: { connected: false, status: 'disconnected', facts: null },
    });
    expect(response.headers.get('cache-control')).toBe('private, no-store');
  });
});

describe('health numbers stay off the log', () => {
  it('does not print recovery or sleep values', async () => {
    const { readFileSync } = await import('node:fs');
    const files = [
      'lib/whoopClient.ts',
      'lib/whoopRoutes.ts',
      'app/api/whoop/today/route.ts',
      'app/api/whoop/connect/route.ts',
      'app/api/whoop/callback/route.ts',
      'app/api/whoop/disconnect/route.ts',
    ];
    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      expect(text).not.toMatch(/console\.(log|info|debug|error|warn)\(/);
    }
  });
});

describe('WHOOP endpoints stay on v2', () => {
  it('uses the production OAuth and developer v2 hosts', () => {
    expect(WHOOP_ENDPOINTS.auth).toBe('https://api.prod.whoop.com/oauth/oauth2/auth');
    expect(WHOOP_ENDPOINTS.token).toBe('https://api.prod.whoop.com/oauth/oauth2/token');
    expect(WHOOP_ENDPOINTS.api).toBe('https://api.prod.whoop.com/developer/v2');
  });
});
