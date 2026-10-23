export const ASSEMBLYAI_TOKEN_URL = 'https://streaming.assemblyai.com/v3/token';
export const VOICE_TOKEN_EXPIRES_SECONDS = 60;
export const VOICE_SESSION_SECONDS = 60;
export const VOICE_NOT_SETUP_ERROR = "Voice isn't set up yet";

export function assemblyAiApiKey(
  env: NodeJS.Dict<string | undefined> = process.env
): string | undefined {
  const key = env.ASSEMBLYAI_API_KEY?.trim();
  return key ? key : undefined;
}

export function voiceEnabled(
  env: NodeJS.Dict<string | undefined> = process.env
): boolean {
  return Boolean(assemblyAiApiKey(env));
}

export type VoiceTokenResult =
  | { status: 200; body: { token: string; expires_in_seconds: number } }
  | { status: 503; body: { error: string } }
  | { status: 502; body: { error: string } };

export async function mintVoiceToken(
  env: NodeJS.Dict<string | undefined> = process.env,
  fetchImpl: typeof fetch = fetch
): Promise<VoiceTokenResult> {
  const key = assemblyAiApiKey(env);
  if (!key) {
    return { status: 503, body: { error: VOICE_NOT_SETUP_ERROR } };
  }

  const url = new URL(ASSEMBLYAI_TOKEN_URL);
  url.searchParams.set('expires_in_seconds', String(VOICE_TOKEN_EXPIRES_SECONDS));
  url.searchParams.set('max_session_duration_seconds', String(VOICE_SESSION_SECONDS));

  try {
    const response = await fetchImpl(url, {
      method: 'GET',
      headers: { Authorization: key },
      cache: 'no-store',
    });
    if (!response.ok) {
      return { status: 502, body: { error: VOICE_NOT_SETUP_ERROR } };
    }
    const data = (await response.json()) as { token?: unknown; expires_in_seconds?: unknown };
    if (typeof data.token !== 'string' || !data.token) {
      return { status: 502, body: { error: VOICE_NOT_SETUP_ERROR } };
    }
    const expires =
      typeof data.expires_in_seconds === 'number' && data.expires_in_seconds > 0
        ? data.expires_in_seconds
        : VOICE_TOKEN_EXPIRES_SECONDS;
    return { status: 200, body: { token: data.token, expires_in_seconds: expires } };
  } catch {
    return { status: 502, body: { error: VOICE_NOT_SETUP_ERROR } };
  }
}

