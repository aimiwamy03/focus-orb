import { auth } from '@/lib/auth';
import { WHOOP_TOKEN_COOKIE } from '@/lib/whoopAuth';
import { whoopResponse } from '@/lib/whoopHttp';
import { handleWhoopToday, whoopSessionFromAuth } from '@/lib/whoopRoutes';
import { connection } from 'next/server';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
  await connection();
  const session = await auth();
  const jar = await cookies();
  const light = new URL(request.url).searchParams.get('light') === '1';
  const result = await handleWhoopToday({
    session: whoopSessionFromAuth(session),
    cookie: jar.get(WHOOP_TOKEN_COOKIE)?.value,
    light,
  });
  return whoopResponse(result);
}
