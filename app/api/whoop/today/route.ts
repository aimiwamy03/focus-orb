import { auth } from '@/lib/auth';
import { WHOOP_TOKEN_COOKIE } from '@/lib/whoopAuth';
import { applyWhoopCookies, handleWhoopToday } from '@/lib/whoopRoutes';
import { connection } from 'next/server';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  await connection();
  const session = await auth();
  const jar = await cookies();
  const light = new URL(request.url).searchParams.get('light') === '1';
  const result = await handleWhoopToday({
    session: { email: session?.user?.email },
    cookie: jar.get(WHOOP_TOKEN_COOKIE)?.value,
    light,
  });
  const response = NextResponse.json(result.body ?? {}, { status: result.status });
  applyWhoopCookies(response.cookies, result);
  return response;
}
