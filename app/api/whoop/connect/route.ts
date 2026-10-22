import { auth } from '@/lib/auth';
import { applyWhoopCookies, handleWhoopConnect } from '@/lib/whoopRoutes';
import { connection } from 'next/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  await connection();
  const session = await auth();
  const result = handleWhoopConnect({
    session: { email: session?.user?.email },
    requestUrl: request.url,
  });
  if (result.redirect) {
    const response = NextResponse.redirect(result.redirect);
    applyWhoopCookies(response.cookies, result);
    return response;
  }
  return NextResponse.json(result.body ?? {}, { status: result.status });
}
