import { forwardToPostHog } from '@/lib/posthog';
import { sanitizeTrackEvent } from '@/lib/track';
import { connection } from 'next/server';

export async function POST(request: Request) {
  await connection();
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }

  const event = sanitizeTrackEvent(payload);
  if (!event) {
    return Response.json({ ok: false }, { status: 400 });
  }

  try {
    await forwardToPostHog(event);
  } catch {
    // PostHog failures must not surface to the client.
  }

  return new Response(null, { status: 204 });
}
