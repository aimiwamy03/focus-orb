import { handlers } from "@/lib/auth";
import { isGoogleAuthConfigured, unconfiguredSessionBody } from "@/lib/googleAuth";
import type { NextRequest } from "next/server";

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

export async function GET(request: NextRequest) {
  return withConfiguredAuth(request, handlers.GET);
}

export async function POST(request: NextRequest) {
  return withConfiguredAuth(request, handlers.POST);
}
