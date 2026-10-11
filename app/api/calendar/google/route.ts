import { auth } from "@/lib/auth";
import {
  fetchGoogleCalendarList,
  fetchMergedGoogleEvents,
} from "@/lib/calendars";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const session = await auth();

    if (!session?.accessToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const url = new URL(request.url);
    const accessToken = session.accessToken;

    if (url.searchParams.get("list") === "1") {
      const calendars = await fetchGoogleCalendarList(accessToken);
      return NextResponse.json({ calendars });
    }

    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    const calendarIds = (url.searchParams.get("calendars") ?? "primary")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);

    const events = await fetchMergedGoogleEvents(accessToken, calendarIds, {
      timeMin: startOfDay.toISOString(),
      timeMax: endOfDay.toISOString(),
    });

    return NextResponse.json({
      events: events.map((event) => ({
        ...event,
        start: event.start.toISOString(),
        end: event.end.toISOString(),
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch events";
    if (message.includes("401")) {
      return NextResponse.json({ error: "Token expired" }, { status: 401 });
    }
    console.error("Failed to fetch Google Calendar events:", error);
    return NextResponse.json(
      { error: "Failed to fetch events" },
      { status: 500 }
    );
  }
}
