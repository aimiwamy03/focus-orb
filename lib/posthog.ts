import type { SanitizedTrackEvent } from './track';

export const POSTHOG_DEFAULT_HOST = 'https://us.i.posthog.com';

export function posthogKey(env: NodeJS.Dict<string | undefined> = process.env): string | undefined {
  const key = env.POSTHOG_KEY?.trim();
  return key ? key : undefined;
}

export function posthogHost(env: NodeJS.Dict<string | undefined> = process.env): string {
  const host = env.POSTHOG_HOST?.trim();
  return host ? host.replace(/\/$/, '') : POSTHOG_DEFAULT_HOST;
}

export async function forwardToPostHog(
  event: SanitizedTrackEvent,
  env: NodeJS.Dict<string | undefined> = process.env,
  fetchImpl: typeof fetch = fetch
): Promise<'sent' | 'skipped'> {
  const key = posthogKey(env);
  if (!key) {
    if (env.NODE_ENV !== 'production') {
      console.info('[track:noop]', event.name, event.properties);
    }
    return 'skipped';
  }

  const body = {
    api_key: key,
    event: event.name,
    distinct_id: 'focus-orb',
    properties: {
      ...event.properties,
      $process_person_profile: false,
    },
  };

  await fetchImpl(`${posthogHost(env)}/capture/`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return 'sent';
}
