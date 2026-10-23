import { beforeEach, describe, expect, it, vi } from 'vitest';

const mintVoiceToken = vi.fn();

vi.mock('next/server', () => ({
  connection: async () => undefined,
}));

vi.mock('@/lib/voiceToken', () => ({
  mintVoiceToken: (...args: unknown[]) => mintVoiceToken(...args),
}));

import { GET } from './route';

describe('GET /api/voice/token', () => {
  beforeEach(() => {
    mintVoiceToken.mockReset();
  });

  it('returns 503 when the key is missing', async () => {
    mintVoiceToken.mockResolvedValue({
      status: 503,
      body: { error: "Voice isn't set up yet" },
    });
    const response = await GET();
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "Voice isn't set up yet" });
    expect(mintVoiceToken).toHaveBeenCalledTimes(1);
  });

  it('returns a short-lived token and never an API key field', async () => {
    mintVoiceToken.mockResolvedValue({
      status: 200,
      body: { token: 'tmp_abc', expires_in_seconds: 60 },
    });
    const response = await GET();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ token: 'tmp_abc', expires_in_seconds: 60 });
    expect(JSON.stringify(body)).not.toMatch(/ASSEMBLYAI|aai_/i);
  });
});
