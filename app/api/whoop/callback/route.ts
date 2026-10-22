import { auth } from '@/lib/auth';
import { WHOOP_STATE_COOKIE } from '@/lib/whoopAuth';
import { applyWhoopCookies, handleWhoopCallback } from '@/lib/whoopRoutes';
import { connection } from 'next/server';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  await connection();
  const session = await auth();
  const jar = await cookies();
  const result = await handleWhoopCallback({
    session: { email: session?.user?.email },
    requestUrl: request.url,
    stateCookie: jar.get(WHOOP_STATE_COOKIE)?.value,
  });
  const response = NextResponse.redirect(result.redirect ?? '/?settings=1');
  applyWhoopCookies(response.cookies, result);
  return response;
}
