import { beforeEach, describe, expect, it, vi } from 'vitest';

const voiceEnabled = vi.fn();

vi.mock('next/server', () => ({
  connection: async () => undefined,
}));

vi.mock('@/lib/voiceToken', () => ({
  voiceEnabled: (...args: unknown[]) => voiceEnabled(...args),
}));

import { GET } from './route';

describe('GET /api/voice/status', () => {
  beforeEach(() => {
    voiceEnabled.mockReset();
  });

  it('returns enabled false without exposing a key field', async () => {
    voiceEnabled.mockReturnValue(false);
    const response = await GET();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ enabled: false });
    expect(JSON.stringify(body)).not.toMatch(/ASSEMBLYAI|aai_|key/i);
  });

  it('returns enabled true when the server has a key', async () => {
    voiceEnabled.mockReturnValue(true);
    const response = await GET();
    expect(await response.json()).toEqual({ enabled: true });
  });
});
