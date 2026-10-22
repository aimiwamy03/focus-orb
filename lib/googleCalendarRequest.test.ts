import { describe, it, expect, vi } from 'vitest';
import {
  googleCalendarErrorResult,
  handleGoogleCalendarGet,
  isPrerenderAbortError,
} from './googleCalendarRequest';

const lunch = {
  summary: 'Lunch',
  start: new Date('2026-10-12T12:00:00.000Z'),
  end: new Date('2026-10-12T12:30:00.000Z'),
  isAllDay: false,
};

describe('handleGoogleCalendarGet', () => {
  it('returns 401 when the session has no Google access token', async () => {
    const fetchList = vi.fn();
    const result = await handleGoogleCalendarGet({
      session: { user: { email: 'amy@example.com' } } as { accessToken?: string },
      url: new URL('https://focus-orb-one.vercel.app/api/calendar/google'),
      fetchList,
    });
    expect(result).toEqual({ status: 401, body: { error: 'Not authenticated' } });
    expect(fetchList).not.toHaveBeenCalled();
  });

  it('lists calendars and loads events when the access token is on the session', async () => {
    const fetchList = vi.fn(async () => [
      { id: 'primary', summary: 'Personal', primary: true },
    ]);
    const fetchEvents = vi.fn(async () => [lunch]);

    const listed = await handleGoogleCalendarGet({
      session: { accessToken: 'ya29.access' },
      url: new URL('https://focus-orb-one.vercel.app/api/calendar/google?list=1'),
      fetchList,
      fetchEvents,
    });
    expect(listed.status).toBe(200);
    expect(listed.body.calendars).toEqual([
      { id: 'primary', summary: 'Personal', primary: true },
    ]);

    const events = await handleGoogleCalendarGet({
      session: { accessToken: 'ya29.access' },
      url: new URL(
        'https://focus-orb-one.vercel.app/api/calendar/google?calendars=primary'
      ),
      now: new Date('2026-10-12T15:00:00.000Z'),
      fetchList,
      fetchEvents,
    });
    expect(events.status).toBe(200);
    expect(events.body.events).toEqual([
      {
        ...lunch,
        start: '2026-10-12T12:00:00.000Z',
        end: '2026-10-12T12:30:00.000Z',
      },
    ]);
    const range = (fetchEvents.mock.calls[0] as unknown as [
      string,
      string[],
      { timeMin: string; timeMax: string },
    ])[2];
    expect(
      (new Date(range.timeMax).getTime() - new Date(range.timeMin).getTime()) / 86_400_000
    ).toBeGreaterThan(2);
  });
});

describe('prerender abort must not become a cached 500', () => {
  it('recognizes the Next headers() hanging-promise error from /api/calendar/google', () => {
    const error = Object.assign(
      new Error(
        'During prerendering, `headers()` rejects when the prerender is complete. Typically these errors are handled by React but if you move `headers()` to a different context by using `setTimeout`, `after`, or similar functions you may observe this error and you should handle it in that context. This occurred at route "/api/calendar/google".'
      ),
      { digest: 'HANGING_PROMISE_REJECTION' }
    );
    expect(isPrerenderAbortError(error)).toBe(true);
  });

  it('rethrows that error instead of returning Failed to fetch events', () => {
    const error = Object.assign(new Error('During prerendering, `headers()` rejects'), {
      digest: 'HANGING_PROMISE_REJECTION',
    });
    expect(() => googleCalendarErrorResult(error)).toThrow(error);
  });

  it('still maps a Google 401 to Token expired', () => {
    expect(googleCalendarErrorResult(new Error('Google events failed: 401'))).toEqual({
      status: 401,
      body: { error: 'Token expired' },
    });
  });
});
