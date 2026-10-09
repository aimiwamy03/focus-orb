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
  status?: string;
  transparency?: string;
  hangoutLink?: string;
  location?: string;
  description?: string;
  attendees?: { self?: boolean; responseStatus?: string }[];
  conferenceData?: {
    entryPoints?: { entryPointType?: string; uri?: string }[];
  };
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
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    const params = new URLSearchParams({
      timeMin: startOfDay.toISOString(),
      timeMax: endOfDay.toISOString(),
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "50",
      conferenceDataVersion: "1",
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
    
    const events = (data.items ?? []).map((event) => {
      const isAllDay = !event.start.dateTime && !!event.start.date;
      const self = event.attendees?.find((attendee) => attendee.self);
      const video = event.conferenceData?.entryPoints?.find((entry) => entry.uri);
      const status = event.status?.toLowerCase();

      return {
        summary: event.summary || "Untitled Event",
        start: event.start.dateTime || event.start.date,
        end: event.end.dateTime || event.end.date,
        isAllDay,
        status:
          status === "cancelled" || status === "confirmed" || status === "tentative"
            ? status
            : undefined,
        transparency: event.transparency === "transparent" ? "transparent" : "opaque",
        declined: self?.responseStatus === "declined" || status === "cancelled",
        hangoutLink: event.hangoutLink,
        location: event.location,
        description: event.description,
        conferenceUri: video?.uri,
      };
    });

    return NextResponse.json({ events });
  } catch (error) {
    console.error("Failed to fetch Google Calendar events:", error);
    return NextResponse.json(
      { error: "Failed to fetch events" },
      { status: 500 }
    );
  }
}
