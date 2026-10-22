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

function hourLabel(date: Date): string {
  return String(date.getHours() % 12 || 12);
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

    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      const cssWidth = canvas.clientWidth;
      const cssHeight = canvas.clientHeight;
      if (cssWidth < 2 || cssHeight < 2) return;
      canvas.width = Math.max(1, Math.floor(cssWidth * dpr));
      canvas.height = Math.max(1, Math.floor(cssHeight * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cssWidth, cssHeight);

      const windowStart = now.getTime();
      const windowEnd = windowStart + WINDOW_MS;
      const pad = 8;
      const inner = Math.max(1, cssWidth - pad * 2);
      const xAt = (time: number) => pad + ((time - windowStart) / WINDOW_MS) * inner;
      const baseline = 8;

      const visible = events
        .filter((event) => event.end.getTime() > windowStart && event.start.getTime() < windowEnd)
        .sort((a, b) => a.start.getTime() - b.start.getTime());

      segmentsRef.current = visible.map((event) => ({
        event,
        x0: xAt(Math.max(event.start.getTime(), windowStart)),
        x1: xAt(Math.min(event.end.getTime(), windowEnd)),
      }));

      const inMeetingX = (x: number) =>
        segmentsRef.current.some((seg, i) => {
          const prev = segmentsRef.current[i - 1];
          const next = segmentsRef.current[i + 1];
          const left = prev && seg.x0 - prev.x1 < 2 ? seg.x0 + 1 : seg.x0;
          const right = next && next.x0 - seg.x1 < 2 ? seg.x1 - 1 : seg.x1;
          return x >= left && x < right;
        });

      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      for (let x = pad; x <= pad + inner; x += 6) {
        if (inMeetingX(x)) continue;
        ctx.fillRect(x - 0.75, baseline - 0.75, 1.5, 1.5);
      }

      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      segmentsRef.current.forEach((seg, i) => {
        const prev = segmentsRef.current[i - 1];
        const next = segmentsRef.current[i + 1];
        const left = prev && Math.abs(seg.x0 - prev.x1) < 2 ? seg.x0 + 1 : seg.x0;
        const right = next && Math.abs(next.x0 - seg.x1) < 2 ? seg.x1 - 1 : seg.x1;
        for (let x = left; x < right; x += 3) {
          ctx.fillRect(x - 1, baseline - 1, 2, 2);
        }
      });

      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.fillRect(pad - 0.5, baseline - 4, 1, 8);

      ctx.font = '10px system-ui, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      const firstHour = new Date(now);
      firstHour.setMinutes(0, 0, 0);
      firstHour.setHours(firstHour.getHours() + 1);
      for (let t = firstHour.getTime(); t <= windowEnd + 1000; t += 60 * 60 * 1000) {
        if (t < windowStart || t > windowEnd) continue;
        ctx.fillText(hourLabel(new Date(t)), xAt(t), baseline + 6);
      }
    };

    draw();
    const observer = new ResizeObserver(() => draw());
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [events, now, hidden]);

  if (hidden) return null;

  return (
    <div
      data-testid="timeline"
      className="relative z-20 w-1/2 min-w-[16rem] max-w-xl shrink-0"
    >
      <canvas
        ref={canvasRef}
        data-text-clear
        className="h-8 w-full cursor-default"
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
          data-text-clear
          className="pointer-events-none absolute bottom-9 whitespace-nowrap text-[length:var(--type-hint)] text-orb-dim"
          style={{ left: hover.x, transform: 'translateX(-50%)' }}
        >
          {hover.label}
        </div>
      ) : null}
    </div>
  );
}
