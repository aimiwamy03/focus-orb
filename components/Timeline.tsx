'use client';

import { useEffect, useRef, useState } from 'react';
import { CalendarEvent } from '@/lib/calendar';
import { formatClockRange } from '@/lib/day';

const WINDOW_MS = 4 * 60 * 60 * 1000;

interface TimelineProps {
  events: CalendarEvent[];
  now: Date;
  hidden: boolean;
}

interface Segment {
  event: CalendarEvent;
  x0: number;
  x1: number;
}

export function Timeline({ events, now, hidden }: TimelineProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hover, setHover] = useState<{ label: string; x: number } | null>(null);
  const segmentsRef = useRef<Segment[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const cssWidth = canvas.clientWidth;
    const cssHeight = canvas.clientHeight;
    canvas.width = Math.max(1, Math.floor(cssWidth * dpr));
    canvas.height = Math.max(1, Math.floor(cssHeight * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssWidth, cssHeight);

    const windowStart = now.getTime();
    const windowEnd = windowStart + WINDOW_MS;
    const pad = 8;
    const inner = Math.max(1, cssWidth - pad * 2);

    const xAt = (time: number) =>
      pad + ((time - windowStart) / WINDOW_MS) * inner;

    const visible = events.filter(
      (event) => event.end.getTime() > windowStart && event.start.getTime() < windowEnd
    );

    segmentsRef.current = visible.map((event) => ({
      event,
      x0: xAt(Math.max(event.start.getTime(), windowStart)),
      x1: xAt(Math.min(event.end.getTime(), windowEnd)),
    }));

    const seed = (x: number, y: number) => {
      const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
      return n - Math.floor(n);
    };

    const dot = 1.5;
    for (let x = pad; x < cssWidth - pad; x += 3) {
      for (let y = 5; y < cssHeight - 4; y += 3) {
        const t = windowStart + ((x - pad) / inner) * WINDOW_MS;
        const inMeeting = visible.some(
          (event) => event.start.getTime() <= t && t < event.end.getTime()
        );
        const threshold = inMeeting ? 0.28 : 0.78;
        if (seed(x, y) < threshold) continue;
        ctx.fillStyle = inMeeting ? 'rgba(255,255,255,0.72)' : 'rgba(255,255,255,0.22)';
        ctx.fillRect(x, y, dot, dot);
      }
    }

    // Now marker at the left of the window
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillRect(pad, 2, 1, cssHeight - 4);

    // Dim hour ticks
    const firstHour = new Date(now);
    firstHour.setMinutes(0, 0, 0);
    firstHour.setHours(firstHour.getHours() + 1);
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    for (let t = firstHour.getTime(); t <= windowEnd; t += 60 * 60 * 1000) {
      const x = xAt(t);
      ctx.fillRect(x, 3, 1, cssHeight - 6);
    }
  }, [events, now]);

  if (hidden) return null;

  return (
    <div
      data-testid="timeline"
      className="absolute bottom-3 left-1/2 z-20 w-[min(640px,70vw)] -translate-x-1/2"
    >
      <canvas
        ref={canvasRef}
        className="h-4 w-full cursor-default"
        onMouseMove={(e) => {
          const bounds = e.currentTarget.getBoundingClientRect();
          const x = e.clientX - bounds.left;
          const hit = segmentsRef.current.find((seg) => x >= seg.x0 && x <= seg.x1);
          if (hit) {
            setHover({
              label: `${hit.event.summary} · ${formatClockRange(hit.event.start, hit.event.end)}`,
              x,
            });
          } else {
            setHover(null);
          }
        }}
        onMouseLeave={() => setHover(null)}
      />
      {hover ? (
        <div
          data-testid="timeline-tooltip"
          className="pointer-events-none absolute bottom-5 whitespace-nowrap rounded bg-black/70 px-2 py-1 text-[10px] text-white/70"
          style={{ left: hover.x, transform: 'translateX(-50%)' }}
        >
          {hover.label}
        </div>
      ) : null}
    </div>
  );
}
