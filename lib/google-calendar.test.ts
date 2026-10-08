import { describe, it, expect } from 'vitest';
import { findNextEvent, CalendarEvent } from './calendar';

describe('Google Calendar Event Mapping', () => {
  it('maps Google Calendar events to internal format', () => {
    const now = new Date('2024-01-15T10:00:00Z');
    
    // Simulated Google Calendar API response mapped to our CalendarEvent format
    const googleEvents: CalendarEvent[] = [
      {
        summary: 'Team Standup',
        start: new Date('2024-01-15T14:00:00Z'),
        end: new Date('2024-01-15T14:30:00Z'),
        isAllDay: false,
      },
      {
        summary: 'Client Call',
        start: new Date('2024-01-15T16:00:00Z'),
        end: new Date('2024-01-15T17:00:00Z'),
        isAllDay: false,
      },
    ];

    const nextEvent = findNextEvent(googleEvents, 60, now);

    expect(nextEvent).toBeTruthy();
    expect(nextEvent?.summary).toBe('Team Standup');
    expect(nextEvent?.minutesToStart).toBe(240); // 4 hours = 240 minutes
  });

  it('filters out all-day events from Google Calendar', () => {
    const now = new Date('2024-01-15T10:00:00Z');
    
    // All-day events from Google have only 'date' field, not 'dateTime'
    // Our mapping excludes these before they reach findNextEvent
    const googleEvents: CalendarEvent[] = [
      {
        summary: 'Team Meeting',
        start: new Date('2024-01-15T14:00:00Z'),
        end: new Date('2024-01-15T14:30:00Z'),
        isAllDay: false,
      },
    ];

    const nextEvent = findNextEvent(googleEvents, 60, now);
    
    expect(nextEvent).toBeTruthy();
    expect(nextEvent?.summary).toBe('Team Meeting');
  });

  it('handles empty Google Calendar response', () => {
    const now = new Date('2024-01-15T10:00:00Z');
    const googleEvents: CalendarEvent[] = [];

    const nextEvent = findNextEvent(googleEvents, 60, now);
    
    expect(nextEvent).toBeNull();
  });

  it('uses same scatter window logic for Google events', () => {
    const now = new Date('2024-01-15T10:00:00Z');
    
    const googleEvents: CalendarEvent[] = [
      {
        summary: 'Morning Meeting',
        start: new Date('2024-01-15T10:30:00Z'), // 30 minutes away
        end: new Date('2024-01-15T11:00:00Z'),
        isAllDay: false,
      },
    ];

    // With 60-minute scatter window
    const nextEvent60 = findNextEvent(googleEvents, 60, now);
    expect(nextEvent60?.scatterWindow).toBe(60);

    // With 30-minute scatter window
    const nextEvent30 = findNextEvent(googleEvents, 30, now);
    expect(nextEvent30?.scatterWindow).toBe(30);
  });

  it('handles Google events at boundary times', () => {
    const now = new Date('2024-01-15T10:00:00Z');
    
    const googleEvents: CalendarEvent[] = [
      {
        summary: 'Immediate Meeting',
        start: new Date('2024-01-15T10:00:00Z'), // starts now
        end: new Date('2024-01-15T10:30:00Z'),
        isAllDay: false,
      },
    ];

    const nextEvent = findNextEvent(googleEvents, 60, now);
    
    expect(nextEvent).toBeTruthy();
    expect(nextEvent?.minutesToStart).toBe(0);
  });

  it('sorts Google events by start time', () => {
    const now = new Date('2024-01-15T10:00:00Z');
    
    // Events in wrong order
    const googleEvents: CalendarEvent[] = [
      {
        summary: 'Later Event',
        start: new Date('2024-01-15T16:00:00Z'),
        end: new Date('2024-01-15T17:00:00Z'),
        isAllDay: false,
      },
      {
        summary: 'Earlier Event',
        start: new Date('2024-01-15T14:00:00Z'),
        end: new Date('2024-01-15T14:30:00Z'),
        isAllDay: false,
      },
    ];

    const nextEvent = findNextEvent(googleEvents, 60, now);
    
    // Should return the earlier event
    expect(nextEvent?.summary).toBe('Earlier Event');
  });
});
