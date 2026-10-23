import { auth } from '@/lib/auth';
import { WHOOP_TOKEN_COOKIE } from '@/lib/whoopAuth';
import { whoopResponse } from '@/lib/whoopHttp';
import { handleWhoopDisconnect, whoopSessionFromAuth } from '@/lib/whoopRoutes';
import { connection } from 'next/server';
import { cookies } from 'next/headers';

export async function POST() {
  await connection();
  const session = await auth();
  const jar = await cookies();
  const result = await handleWhoopDisconnect({
    session: whoopSessionFromAuth(session),
    cookie: jar.get(WHOOP_TOKEN_COOKIE)?.value,
  });
  return whoopResponse(result);
}
