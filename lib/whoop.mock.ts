import {
  type WhoopCachedSummary,
  type WhoopConnectionStatus,
  type WhoopFacts,
} from './whoop';

export const WHOOP_MOCK_KEYS = [
  'green',
  'yellow',
  'red',
  'sleep',
  'debt',
  'strain',
  'workout',
  'late',
  'pending',
  'calibrating',
  'nodata',
  'disconnected',
] as const;

export type WhoopMockKey = (typeof WHOOP_MOCK_KEYS)[number];

export function isWhoopMockKey(value: string | null | undefined): value is WhoopMockKey {
  return !!value && (WHOOP_MOCK_KEYS as readonly string[]).includes(value);
}

export function parseWhoopQuery(value: string | null | undefined): WhoopMockKey | null {
  return isWhoopMockKey(value) ? value : null;
}

const MOCK_NOW = Date.parse('2026-10-22T12:00:00');

function scored(
  recovery: number,
  extra: Partial<WhoopFacts> = {},
  now = MOCK_NOW
): WhoopFacts {
  return {
    recovery,
    recoveryState: 'scored',
    sleepPerformance: 90,
    sleepMinutes: 7 * 60 + 20,
    sleepDebtMinutes: 0,
    yesterdayStrain: 8,
    lastWorkoutEndedAt: null,
    wakeAt: now - 4 * 60 * 60 * 1000,
    now,
    ...extra,
  };
}

export function mockWhoopFacts(key: WhoopMockKey, nowMs: number = MOCK_NOW): WhoopFacts | null {
  switch (key) {
    case 'disconnected':
    case 'nodata':
      return null;
    case 'green':
      return scored(82, { sleepMinutes: 7 * 60 + 20, sleepPerformance: 90 }, nowMs);
    case 'yellow':
      return scored(51, { sleepMinutes: 6 * 60 + 10, sleepPerformance: 80 }, nowMs);
    case 'red':
      return scored(28, { sleepMinutes: 5 * 60 + 50, sleepPerformance: 72 }, nowMs);
    case 'sleep':
      return scored(75, { sleepPerformance: 62, sleepMinutes: 6 * 60 }, nowMs);
    case 'debt':
      return scored(78, { sleepDebtMinutes: 60, sleepMinutes: 5 * 60 }, nowMs);
    case 'strain':
      return scored(80, { yesterdayStrain: 16 }, nowMs);
    case 'workout':
      return scored(80, { lastWorkoutEndedAt: nowMs - 10 * 60_000 }, nowMs);
    case 'late':
      return scored(80, { wakeAt: nowMs - 11 * 60 * 60 * 1000 }, nowMs);
    case 'pending':
      return {
        ...scored(0, {}, nowMs),
        recovery: null,
        recoveryState: 'pending',
      };
    case 'calibrating':
      return {
        ...scored(40, {}, nowMs),
        recoveryState: 'calibrating',
      };
  }
}

export function mockWhoopStatus(key: WhoopMockKey): WhoopConnectionStatus {
  if (key === 'disconnected') return 'disconnected';
  if (key === 'nodata') return 'no-data';
  if (key === 'pending') return 'pending';
  if (key === 'calibrating') return 'calibrating';
  return 'ok';
}

export function mockWhoopSummary(
  key: WhoopMockKey,
  nowMs: number = Date.now()
): WhoopCachedSummary {
  return {
    connected: key !== 'disconnected',
    email: key === 'disconnected' || key === 'nodata' ? null : 'mock@whoop.test',
    status: mockWhoopStatus(key),
    facts: mockWhoopFacts(key, nowMs),
    fetchedAt: nowMs,
  };
}

