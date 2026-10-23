import { auth } from '@/lib/auth';
import { WHOOP_CACHE_CONTROL } from '@/lib/whoopAuth';
import { whoopResponse } from '@/lib/whoopHttp';
import { applyWhoopCookies, handleWhoopConnect, whoopSessionFromAuth } from '@/lib/whoopRoutes';
import { connection } from 'next/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  await connection();
  const session = await auth();
  const result = handleWhoopConnect({
    session: whoopSessionFromAuth(session),
    requestUrl: request.url,
  });
  const asJson = new URL(request.url).searchParams.get('json') === '1';
  if (asJson || !result.redirect) {
    const response = NextResponse.json(result.body ?? {}, {
      status: asJson && result.redirect ? 200 : result.status,
    });
    response.headers.set('Cache-Control', WHOOP_CACHE_CONTROL);
    applyWhoopCookies(response.cookies, result);
    return response;
  }
  return whoopResponse(result);
}
