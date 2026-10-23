import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { sanitizeTrackEvent, track } from './track';
import { forwardToPostHog, posthogKey } from './posthog';

describe('sanitizeTrackEvent', () => {
  it('keeps voice start and completed payloads and drops transcript text', () => {
    expect(
      sanitizeTrackEvent({
        name: 'block_started_by_voice',
        minutes: 40,
        adjusted: true,
        transcript: 'Orb, 40 minutes on the Mercor application',
        label: 'Mercor application',
      })
    ).toEqual({
      name: 'block_started_by_voice',
      properties: { minutes: 40, adjusted: true },
    });
    expect(
      sanitizeTrackEvent({
        name: 'block_completed',
        properties: { minutes: 25.4, source: 'voice', task: 'secret' },
      })
    ).toEqual({
      name: 'block_completed',
      properties: { minutes: 25, source: 'voice' },
    });
    expect(sanitizeTrackEvent({ name: 'other', minutes: 10 })).toBeNull();
  });
});

describe('track', () => {
  const fetchMock = vi.fn<typeof fetch>(async () => new Response(null, { status: 204 }));

  beforeEach(() => {
    fetchMock.mockClear();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('posts sanitized events to /api/events', () => {
    track({ name: 'block_started_by_voice', minutes: 40, adjusted: false });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/events',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          name: 'block_started_by_voice',
          properties: { minutes: 40, adjusted: false },
        }),
      })
    );
  });
});

describe('forwardToPostHog', () => {
  it('no-ops without POSTHOG_KEY', async () => {
    const fetchImpl = vi.fn();
    await expect(
      forwardToPostHog(
        { name: 'block_completed', properties: { minutes: 20, source: 'manual' } },
        { NODE_ENV: 'test' },
        fetchImpl
      )
    ).resolves.toBe('skipped');
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(posthogKey({})).toBeUndefined();
  });

  it('forwards only allowed properties when a key is set', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response(null, { status: 200 }));
    await expect(
      forwardToPostHog(
        { name: 'block_started_by_voice', properties: { minutes: 30, adjusted: true } },
        { POSTHOG_KEY: 'phc_test', POSTHOG_HOST: 'https://example.posthog' },
        fetchImpl
      )
    ).resolves.toBe('sent');
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://example.posthog/capture/',
      expect.objectContaining({ method: 'POST' })
    );
    const init = fetchImpl.mock.calls[0]?.[1];
    const body = JSON.parse(String(init?.body));
    expect(body.event).toBe('block_started_by_voice');
    expect(body.properties).toMatchObject({ minutes: 30, adjusted: true });
    expect(body.properties).not.toHaveProperty('transcript');
    expect(body.properties).not.toHaveProperty('label');
  });
});
