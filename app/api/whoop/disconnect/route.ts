import { auth } from '@/lib/auth';
import { WHOOP_TOKEN_COOKIE } from '@/lib/whoopAuth';
import { applyWhoopCookies, handleWhoopDisconnect } from '@/lib/whoopRoutes';
import { connection } from 'next/server';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST() {
  await connection();
  const session = await auth();
  const jar = await cookies();
  const result = await handleWhoopDisconnect({
    session: { email: session?.user?.email },
    cookie: jar.get(WHOOP_TOKEN_COOKIE)?.value,
  });
  const response = NextResponse.json(result.body ?? {}, { status: result.status });
  applyWhoopCookies(response.cookies, result);
  return response;
}
