export const ASSEMBLYAI_WS_URL = 'wss://streaming.assemblyai.com/v3/ws';

export function assemblyAiSocketUrl(token: string): string {
  const url = new URL(ASSEMBLYAI_WS_URL);
  url.searchParams.set('sample_rate', '16000');
  url.searchParams.set('encoding', 'pcm_s16le');
  url.searchParams.set('token', token);
  return url.toString();
}
