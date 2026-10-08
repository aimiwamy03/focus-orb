import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

interface GoogleCalendarEvent {
  id: string;
  summary: string;
  start: {
    dateTime?: string;
    date?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
  };
  recurrence?: string[];
}

interface GoogleCalendarResponse {
  items: GoogleCalendarEvent[];
}

export async function GET() {
  try {
    const session = await auth();
    
    if (!session?.accessToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const now = new Date();
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    const params = new URLSearchParams({
      timeMin: now.toISOString(),
      timeMax: endOfDay.toISOString(),
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "10",
    });

    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
      {
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
        },
      }
    );

    if (!response.ok) {
      if (response.status === 401) {
        return NextResponse.json({ error: "Token expired" }, { status: 401 });
      }
      throw new Error(`Google Calendar API error: ${response.status}`);
    }

    const data: GoogleCalendarResponse = await response.json();
    
    // Filter out all-day events and map to our CalendarEvent format
    const events = data.items
      .filter((event) => event.start.dateTime) // Exclude all-day events
      .map((event) => ({
        summary: event.summary || "Untitled Event",
        start: event.start.dateTime!,
        end: event.end.dateTime!,
        isAllDay: false,
      }));

    return NextResponse.json({ events });
  } catch (error) {
    console.error("Failed to fetch Google Calendar events:", error);
    return NextResponse.json(
      { error: "Failed to fetch events" },
      { status: 500 }
    );
  }
}
