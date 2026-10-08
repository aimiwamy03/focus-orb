'use client';

import { useState } from 'react';
import { formatTimeRemaining } from '@/lib/scatter';

interface FocusControlProps {
  isActive: boolean;
  timeRemaining: number | null;
  onStart: (duration: number) => void;
  onStop: () => void;
}

export function FocusControl({ isActive, timeRemaining, onStart, onStop }: FocusControlProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (isActive && timeRemaining !== null) {
    return (
      <div className="fixed bottom-4 right-4 z-40">
        <div className="bg-black/40 backdrop-blur-md rounded-lg border border-white/10 p-3 min-w-[140px]">
          <div className="text-white/90 text-xs font-medium mb-1.5">Focus block</div>
          <div className="text-white/70 text-sm mb-2.5">
            {formatTimeRemaining(timeRemaining)}
          </div>
          <button
            onClick={onStop}
            className="w-full px-3 py-1.5 bg-white/10 hover:bg-white/15 text-white/80 hover:text-white rounded text-xs font-medium transition-colors"
          >
            Stop
          </button>
        </div>
      </div>
    );
  }

  if (isExpanded) {
    return (
      <div className="fixed bottom-4 right-4 z-40">
        <div className="bg-black/40 backdrop-blur-md rounded-lg border border-white/10 p-3 min-w-[140px]">
          <div className="flex items-center justify-between mb-2">
            <div className="text-white/90 text-xs font-medium">Start focus</div>
            <button
              onClick={() => setIsExpanded(false)}
              className="text-white/40 hover:text-white/70 transition-colors text-lg leading-none"
              aria-label="Close"
            >
              ×
            </button>
          </div>
          <div className="space-y-1.5">
            {[25, 50, 90].map((minutes) => (
              <button
                key={minutes}
                onClick={() => {
                  onStart(minutes);
                  setIsExpanded(false);
                }}
                className="w-full px-3 py-1.5 bg-white/10 hover:bg-white/15 text-white/80 hover:text-white rounded text-xs font-medium transition-colors"
              >
                {minutes} min
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => setIsExpanded(true)}
      className="fixed bottom-4 right-4 z-40 bg-black/40 backdrop-blur-md rounded-full px-4 py-2 text-white/70 hover:text-white/90 text-xs font-medium hover:bg-black/50 transition-all border border-white/10"
    >
      Start focus
    </button>
  );
}
