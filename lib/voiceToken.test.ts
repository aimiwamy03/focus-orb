import { describe, expect, it, vi } from 'vitest';
import { assemblyAiSocketUrl } from './voiceSocket';
import {
  assemblyAiApiKey,
  mintVoiceToken,
  voiceEnabled,
  VOICE_NOT_SETUP_ERROR,
} from './voiceToken';

describe('assemblyAiApiKey', () => {
  it('reads ASSEMBLYAI_API_KEY and ignores blanks', () => {
    expect(assemblyAiApiKey({ ASSEMBLYAI_API_KEY: ' aai_test ' })).toBe('aai_test');
    expect(assemblyAiApiKey({ ASSEMBLYAI_API_KEY: '' })).toBeUndefined();
    expect(assemblyAiApiKey({})).toBeUndefined();
    expect(voiceEnabled({ ASSEMBLYAI_API_KEY: 'aai_test' })).toBe(true);
    expect(voiceEnabled({})).toBe(false);
  });
});

describe('mintVoiceToken', () => {
  it('returns 503 when the key is missing and never calls AssemblyAI', async () => {
    const fetchImpl = vi.fn();
    await expect(mintVoiceToken({}, fetchImpl)).resolves.toEqual({
      status: 503,
      body: { error: VOICE_NOT_SETUP_ERROR },
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('mints a short-lived token with the raw API key header', async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      expect(url).toContain('https://streaming.assemblyai.com/v3/token');
      expect(url).toContain('expires_in_seconds=60');
      expect(init?.headers).toEqual({ Authorization: 'aai_secret' });
      expect(init?.headers).not.toEqual({ Authorization: 'Bearer aai_secret' });
      return new Response(JSON.stringify({ token: 'tmp_abc', expires_in_seconds: 60 }), {
        status: 200,
      });
    });

    await expect(
      mintVoiceToken({ ASSEMBLYAI_API_KEY: 'aai_secret' }, fetchImpl)
    ).resolves.toEqual({
      status: 200,
      body: { token: 'tmp_abc', expires_in_seconds: 60 },
    });
  });

  it('maps upstream failures to 502 without echoing the key', async () => {
    const fetchImpl = vi.fn(async () => new Response('nope', { status: 401 }));
    const result = await mintVoiceToken({ ASSEMBLYAI_API_KEY: 'aai_secret' }, fetchImpl);
    expect(result.status).toBe(502);
    expect(JSON.stringify(result)).not.toContain('aai_secret');
    expect(result.body).toEqual({ error: VOICE_NOT_SETUP_ERROR });
  });
});

describe('assemblyAiSocketUrl', () => {
  it('puts the temporary token in the query and never an API key', () => {
    const url = assemblyAiSocketUrl('tmp_abc');
    expect(url.startsWith('wss://streaming.assemblyai.com/v3/ws')).toBe(true);
    expect(url).toContain('token=tmp_abc');
    expect(url).toContain('sample_rate=16000');
    expect(url).not.toContain('ASSEMBLYAI');
  });
});
