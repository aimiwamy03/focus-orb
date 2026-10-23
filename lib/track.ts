export const TRACK_EVENTS = ['block_started_by_voice', 'block_completed'] as const;
export type TrackEventName = (typeof TRACK_EVENTS)[number];

export type TrackEvent =
  | { name: 'block_started_by_voice'; minutes: number; adjusted: boolean }
  | { name: 'block_completed'; minutes: number; source: 'voice' | 'manual' };

export type SanitizedTrackEvent =
  | { name: 'block_started_by_voice'; properties: { minutes: number; adjusted: boolean } }
  | { name: 'block_completed'; properties: { minutes: number; source: 'voice' | 'manual' } };

const TRACK_NAMES = new Set<string>(TRACK_EVENTS);
const BLOCKED_KEYS = new Set([
  'transcript',
  'label',
  'task',
  'text',
  'utterance',
  'speech',
]);

function asMinutes(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n);
}

export function sanitizeTrackEvent(input: unknown): SanitizedTrackEvent | null {
  if (!input || typeof input !== 'object') return null;
  const raw = input as Record<string, unknown>;
  const name = typeof raw.name === 'string' ? raw.name : '';
  if (!TRACK_NAMES.has(name)) return null;

  const bag =
    raw.properties && typeof raw.properties === 'object'
      ? (raw.properties as Record<string, unknown>)
      : raw;

  for (const key of Object.keys(bag)) {
    if (BLOCKED_KEYS.has(key)) {
      // Drop PII fields rather than rejecting the whole event.
      delete bag[key];
    }
  }

  const minutes = asMinutes(bag.minutes);
  if (minutes == null) return null;

  if (name === 'block_started_by_voice') {
    return {
      name,
      properties: {
        minutes,
        adjusted: Boolean(bag.adjusted),
      },
    };
  }

  const source = bag.source === 'voice' ? 'voice' : bag.source === 'manual' ? 'manual' : null;
  if (!source) return null;
  return {
    name: 'block_completed',
    properties: { minutes, source },
  };
}

export function track(event: TrackEvent): void {
  const payload = sanitizeTrackEvent(event);
  if (!payload) return;
  if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'production') {
    console.info('[track]', payload.name, payload.properties);
  }
  if (typeof fetch === 'undefined') return;
  void fetch('/api/events', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => {
    // Tracking must never break focus.
  });
}
