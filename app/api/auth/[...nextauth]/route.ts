import { handlers } from "@/lib/auth";
import { isGoogleAuthConfigured, unconfiguredSessionBody } from "@/lib/googleAuth";
import { applyWhoopCookies, clearWhoopSessionCookies } from "@/lib/whoopRoutes";
import { NextResponse, type NextRequest } from "next/server";

type AuthHandler = (request: NextRequest) => Promise<Response>;

async function withConfiguredAuth(
  request: NextRequest,
  handle: AuthHandler
): Promise<Response> {
  if (!isGoogleAuthConfigured()) {
    return Response.json(unconfiguredSessionBody());
  }
  return handle(request);
}

function isSignOutRequest(request: NextRequest): boolean {
  return request.nextUrl.pathname.endsWith("/signout");
}

function withClearedWhoopCookie(response: Response): NextResponse {
  const next = new NextResponse(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
  applyWhoopCookies(next.cookies, clearWhoopSessionCookies());
  return next;
}

export async function GET(request: NextRequest) {
  return withConfiguredAuth(request, handlers.GET);
}

export async function POST(request: NextRequest) {
  const response = await withConfiguredAuth(request, handlers.POST);
  if (isSignOutRequest(request)) {
    return withClearedWhoopCookie(response);
  }
  return response;
}
