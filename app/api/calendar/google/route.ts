import { auth } from "@/lib/auth";
import {
  googleCalendarErrorResult,
  handleGoogleCalendarGet,
} from "@/lib/googleCalendarRequest";
import { connection } from "next/server";
import { unstable_rethrow } from "next/navigation";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  // Wait for the incoming request. Catching auth()/headers() during
  // prerender used to complete the route as a static 500.
  await connection();

  try {
    const session = await auth();
    const result = await handleGoogleCalendarGet({
      session,
      url: new URL(request.url),
    });
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    unstable_rethrow(error);
    const result = googleCalendarErrorResult(error);
    if (result.status >= 500) {
      console.error("Failed to fetch Google Calendar events:", error);
    }
    return NextResponse.json(result.body, { status: result.status });
  }
}
