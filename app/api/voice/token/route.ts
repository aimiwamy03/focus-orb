import { mintVoiceToken } from '@/lib/voiceToken';
import { connection } from 'next/server';

export async function GET() {
  await connection();
  const result = await mintVoiceToken();
  return Response.json(result.body, {
    status: result.status,
    headers: { 'cache-control': 'no-store' },
  });
}
