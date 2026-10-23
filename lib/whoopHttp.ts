import { NextResponse } from 'next/server';
import { WHOOP_CACHE_CONTROL } from './whoopAuth';
import { applyWhoopCookies, type WhoopRouteResult } from './whoopRoutes';

export { WHOOP_CACHE_CONTROL };

export function whoopResponse(result: WhoopRouteResult): NextResponse {
  const response = result.redirect
    ? NextResponse.redirect(result.redirect)
    : NextResponse.json(result.body ?? {}, { status: result.status });
  response.headers.set('Cache-Control', WHOOP_CACHE_CONTROL);
  applyWhoopCookies(response.cookies, result);
  return response;
}
