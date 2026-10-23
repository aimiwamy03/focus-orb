import { voiceEnabled } from '@/lib/voiceToken';
import { connection } from 'next/server';

export async function GET() {
  await connection();
  return Response.json(
    { enabled: voiceEnabled() },
    { headers: { 'cache-control': 'no-store' } }
  );
}
