import { auth } from '@/lib/auth';
import { WHOOP_STATE_COOKIE } from '@/lib/whoopAuth';
import { whoopResponse } from '@/lib/whoopHttp';
import { handleWhoopCallback, whoopSessionFromAuth } from '@/lib/whoopRoutes';
import { connection } from 'next/server';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
  await connection();
  const session = await auth();
  const jar = await cookies();
  const result = await handleWhoopCallback({
    session: whoopSessionFromAuth(session),
    requestUrl: request.url,
    stateCookie: jar.get(WHOOP_STATE_COOKIE)?.value,
  });
  return whoopResponse(result);
}
