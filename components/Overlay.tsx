'use client';

import { NextEventInfo } from '@/lib/calendar';
import { formatTimeRemaining } from '@/lib/scatter';

interface OverlayProps {
  show: boolean;
  nextEvent: NextEventInfo | null;
  isManualFocus: boolean;
  manualTimeRemaining: number | null;
}

export function Overlay({ show, nextEvent, isManualFocus, manualTimeRemaining }: OverlayProps) {
  if (!show) return null;

  return (
    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
      <div className="text-center space-y-2 px-4">
        {isManualFocus && manualTimeRemaining !== null ? (
          <>
            <div className="text-white text-2xl font-light">
              Focus block
            </div>
            <div className="text-white/60 text-lg">
              {formatTimeRemaining(manualTimeRemaining)} remaining
            </div>
          </>
        ) : nextEvent ? (
          <>
            <div className="text-white text-2xl font-light max-w-md truncate">
              {nextEvent.summary}
            </div>
            <div className="text-white/60 text-lg">
              in {formatTimeRemaining(nextEvent.minutesToStart)}
            </div>
          </>
        ) : (
          <div className="text-white/40 text-lg">
            No upcoming meetings
          </div>
        )}
      </div>
    </div>
  );
}
