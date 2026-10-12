export interface CalendarEvent {
  summary: string;
  start: Date;
  end: Date;
  isAllDay: boolean;
  rrule?: string;
  status?: 'confirmed' | 'tentative' | 'cancelled';
  transparency?: 'opaque' | 'transparent';
  declined?: boolean;
  hangoutLink?: string;
  location?: string;
  description?: string;
  conferenceUri?: string;
}

export interface NextEventInfo {
  summary: string;
  start: Date;
  minutesToStart: number;
  scatterWindow: number;
}

/**
 * Parse ICS (iCalendar) content into events
 */
export function parseICS(icsContent: string): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  const lines = icsContent.split(/\r?\n/);
  
  let currentEvent: Partial<CalendarEvent> | null = null;
  let inEvent = false;
  
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();
    
    // Handle line folding (lines starting with space or tab)
    while (i + 1 < lines.length && /^[ \t]/.test(lines[i + 1])) {
      line += lines[i + 1].trim();
      i++;
    }
    
    if (line === 'BEGIN:VEVENT') {
      inEvent = true;
      currentEvent = {};
    } else if (line === 'END:VEVENT' && inEvent && currentEvent) {
      if (currentEvent.summary && currentEvent.start && currentEvent.end) {
        events.push(currentEvent as CalendarEvent);
      }
      currentEvent = null;
      inEvent = false;
    } else if (inEvent && currentEvent) {
      // Parse event properties
      const colonIndex = line.indexOf(':');
      const semicolonIndex = line.indexOf(';');
      const splitIndex = semicolonIndex !== -1 && semicolonIndex < colonIndex 
        ? semicolonIndex 
        : colonIndex;
      
      if (splitIndex === -1) continue;
      
      const key = line.substring(0, splitIndex);
      const value = line.substring(colonIndex + 1);
      
      if (key.startsWith('DTSTART')) {
        const isAllDay = line.includes('VALUE=DATE') && !line.includes('TZID');
        currentEvent.start = parseICSDate(value);
        currentEvent.isAllDay = isAllDay;
      } else if (key.startsWith('DTEND')) {
        currentEvent.end = parseICSDate(value);
      } else if (key === 'SUMMARY') {
        currentEvent.summary = unescapeICS(value);
      } else if (key === 'RRULE') {
        currentEvent.rrule = value;
      } else if (key === 'TRANSP') {
        currentEvent.transparency = value === 'TRANSPARENT' ? 'transparent' : 'opaque';
      } else if (key === 'STATUS') {
        const status = value.toLowerCase();
        if (status === 'cancelled' || status === 'confirmed' || status === 'tentative') {
          currentEvent.status = status;
        }
      } else if (key === 'LOCATION') {
        currentEvent.location = unescapeICS(value);
      } else if (key === 'DESCRIPTION') {
        currentEvent.description = unescapeICS(value);
      } else if (key === 'URL') {
        currentEvent.hangoutLink = value;
      }
    }
  }
  
  return events;
}

function unescapeICS(value: string): string {
  return value.replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\n/g, '\n');
}

/**
 * Parse ICS date format (YYYYMMDD or YYYYMMDDTHHMMSS or YYYYMMDDTHHMMSSZ)
 */
function parseICSDate(dateStr: string): Date {
  dateStr = dateStr.trim();
  
  // Remove timezone identifier if present
  if (dateStr.includes('TZID=')) {
    dateStr = dateStr.split(':')[1];
  }
  
  const year = parseInt(dateStr.substring(0, 4), 10);
  const month = parseInt(dateStr.substring(4, 6), 10) - 1; // JS months are 0-indexed
  const day = parseInt(dateStr.substring(6, 8), 10);
  
  // Check if it includes time
  if (dateStr.includes('T')) {
    const hour = parseInt(dateStr.substring(9, 11), 10);
    const minute = parseInt(dateStr.substring(11, 13), 10);
    const second = parseInt(dateStr.substring(13, 15), 10);
    
    // Check if it's UTC (ends with Z)
    if (dateStr.endsWith('Z')) {
      return new Date(Date.UTC(year, month, day, hour, minute, second));
    } else {
      return new Date(year, month, day, hour, minute, second);
    }
  }
  
  // Date only (all-day event)
  return new Date(year, month, day);
}

/**
 * Expand recurring events for the next 7 days
 */
export function expandRecurringEvents(events: CalendarEvent[]): CalendarEvent[] {
  const expanded: CalendarEvent[] = [];
  const now = new Date();
  // Expand events up to 7 full days from now
  const endDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000 + 24 * 60 * 60 * 1000); // 8 days to be inclusive
  
  for (const event of events) {
    if (!event.rrule) {
      // Non-recurring event
      if (event.start <= endDate) {
        expanded.push(event);
      }
    } else {
      // Simple RRULE parsing (handles FREQ=DAILY and FREQ=WEEKLY)
      const rrule = event.rrule;
      const freq = rrule.match(/FREQ=(\w+)/)?.[1];
      const interval = parseInt(rrule.match(/INTERVAL=(\d+)/)?.[1] || '1', 10);
      const count = rrule.match(/COUNT=(\d+)/)?.[1];
      const until = rrule.match(/UNTIL=([^;]+)/)?.[1];
      
      let maxCount = count ? parseInt(count, 10) : 52; // Default limit
      let current = new Date(event.start);
      let occurrences = 0;
      
      while (current <= endDate && occurrences < maxCount) {
        if (current >= event.start) {
          const duration = event.end.getTime() - event.start.getTime();
          expanded.push({
            ...event,
            start: new Date(current),
            end: new Date(current.getTime() + duration),
          });
          occurrences++;
        }
        
        // Increment based on frequency
        if (freq === 'DAILY') {
          current = new Date(current.getTime() + interval * 24 * 60 * 60 * 1000);
        } else if (freq === 'WEEKLY') {
          current = new Date(current.getTime() + interval * 7 * 24 * 60 * 60 * 1000);
        } else {
          break; // Unsupported frequency
        }
        
        if (until) {
          const untilDate = parseICSDate(until);
          if (current > untilDate) break;
        }
      }
    }
  }
  
  return expanded;
}

/**
 * Find the next upcoming event
 */
export function findNextEvent(
  events: CalendarEvent[], 
  scatterWindow: number = 60,
  now: Date = new Date()
): NextEventInfo | null {
  // Filter out all-day, declined, free/transparent, and past events
  const upcomingEvents = events
    .filter(e => !e.isAllDay && !e.declined && e.status !== 'cancelled' && e.transparency !== 'transparent' && e.start >= now)
    .sort((a, b) => a.start.getTime() - b.start.getTime());
  
  if (upcomingEvents.length === 0) return null;
  
  const nextEvent = upcomingEvents[0];
  const minutesToStart = (nextEvent.start.getTime() - now.getTime()) / (1000 * 60);
  
  return {
    summary: nextEvent.summary,
    start: nextEvent.start,
    minutesToStart,
    scatterWindow,
  };
}
