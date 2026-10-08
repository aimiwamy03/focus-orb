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
    <div className="absolute inset-x-0 bottom-[10vh] flex justify-center pointer-events-none">
      <div className="bg-black/60 backdrop-blur-sm rounded-full px-5 py-2 text-center">
        {isManualFocus && manualTimeRemaining !== null ? (
          <>
            <div className="text-white text-xl font-light">
              Focus block
            </div>
            <div className="text-white/60 text-sm">
              {formatTimeRemaining(manualTimeRemaining)} remaining
            </div>
          </>
        ) : nextEvent ? (
          <>
            <div className="text-white text-xl font-light max-w-md truncate">
              {nextEvent.summary}
            </div>
            <div className="text-white/60 text-sm">
              in {formatTimeRemaining(nextEvent.minutesToStart)}
            </div>
          </>
        ) : (
          <div className="text-white/40 text-base">
            No upcoming meetings
          </div>
        )}
      </div>
    </div>
  );
}
