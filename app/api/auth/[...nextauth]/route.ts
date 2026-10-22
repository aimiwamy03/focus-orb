import { handlers } from "@/lib/auth";
import { isGoogleAuthConfigured, unconfiguredSessionBody } from "@/lib/googleAuth";

async function withConfiguredAuth(
  request: Request,
  handle: (request: Request) => Promise<Response>
): Promise<Response> {
  if (!isGoogleAuthConfigured()) {
    return Response.json(unconfiguredSessionBody());
  }
  return handle(request);
}

export async function GET(request: Request) {
  return withConfiguredAuth(request, handlers.GET);
}

export async function POST(request: Request) {
  return withConfiguredAuth(request, handlers.POST);
}
