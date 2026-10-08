import { NextRequest, NextResponse } from 'next/server';

/**
 * Calendar ICS proxy endpoint
 * 
 * This route proxies calendar ICS fetches to avoid CORS issues.
 * IMPORTANT: The calendar URL is NEVER logged or persisted server-side.
 * It comes from the client (localStorage) and is only used transiently for this fetch.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url } = body;

    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { error: 'Invalid or missing URL' },
        { status: 400 }
      );
    }

    // Fetch the ICS content from the provided URL
    // This is a transient fetch - the URL is NOT logged or persisted
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'FocusOrb/1.0',
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch calendar: ${response.statusText}` },
        { status: response.status }
      );
    }

    const icsContent = await response.text();

    // Return the ICS content as plain text
    return new NextResponse(icsContent, {
      headers: {
        'Content-Type': 'text/calendar',
      },
    });
  } catch (error) {
    console.error('Calendar proxy error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
