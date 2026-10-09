'use client';

import { useState, useEffect } from 'react';

const SEEN_KEY = 'focusOrb:guideSeen';

export function Handbook() {
  const [isCollapsed, setIsCollapsed] = useState(true);

  useEffect(() => {
    const seen = localStorage.getItem(SEEN_KEY);
    if (seen === 'true') {
      setIsCollapsed(true);
    } else {
      setIsCollapsed(false);
      localStorage.setItem(SEEN_KEY, 'true');
    }
  }, []);

  const toggle = () => {
    setIsCollapsed((prev) => !prev);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      
      if (e.key === '?') {
        e.preventDefault();
        toggle();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCollapsed]);

  if (isCollapsed) {
    return (
      <button
        onClick={toggle}
        className="fixed top-4 left-4 z-40 bg-black/30 backdrop-blur-sm rounded-full px-3 py-1.5 text-white/40 text-xs hover:text-white/60 hover:bg-black/40 transition-all"
        aria-label="Show guide"
      >
        ?
      </button>
    );
  }

  return (
    <div className="fixed top-4 left-4 z-40 bg-black/40 backdrop-blur-md rounded-lg border border-white/5 w-80 max-w-[calc(100vw-2rem)] max-h-[calc(100vh-2rem)] overflow-y-auto">
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-white/90 text-sm font-medium">Focus Orb Guide</h2>
          <button
            onClick={toggle}
            className="text-white/40 hover:text-white/70 transition-colors text-lg leading-none flex-shrink-0"
            aria-label="Hide guide"
          >
            ×
          </button>
        </div>

        <div className="space-y-2.5 text-white/60 text-xs leading-relaxed">
          <section>
            <h3 className="text-white/70 text-xs font-medium mb-1">What it shows</h3>
            <p>
              Dense and bright orb = focus time. Scatters as your next meeting 
              approaches. Dims during a meeting.
            </p>
          </section>

          <section>
            <h3 className="text-white/70 text-xs font-medium mb-1">Connect calendar</h3>
            <p>
              Press <kbd className="bg-white/5 px-1 py-0.5 rounded text-[10px] font-mono">s</kbd> and 
              click "Connect Google Calendar" to sign in once. Your calendar 
              stays connected across visits. You can disconnect anytime in settings.
            </p>
          </section>

          <section>
            <h3 className="text-white/70 text-xs font-medium mb-1">Manual focus blocks</h3>
            <p>
              Click "Start focus" in the bottom-right corner and choose 25, 50, 
              or 90 minutes. Press <kbd className="bg-white/5 px-1 py-0.5 rounded text-[10px] font-mono">space</kbd> for 
              a quick 25-minute block. Click "Stop" to end early.
            </p>
          </section>

          <section>
            <h3 className="text-white/70 text-xs font-medium mb-1">Keyboard shortcuts</h3>
            <div className="space-y-0.5 font-mono text-[10px]">
              <div><kbd className="bg-white/5 px-1 py-0.5 rounded">s</kbd> <span className="text-white/50">settings</span></div>
              <div><kbd className="bg-white/5 px-1 py-0.5 rounded">f</kbd> <span className="text-white/50">fullscreen</span></div>
              <div><kbd className="bg-white/5 px-1 py-0.5 rounded">space</kbd> <span className="text-white/50">start/stop focus</span></div>
              <div><kbd className="bg-white/5 px-1 py-0.5 rounded">?</kbd> <span className="text-white/50">toggle this guide</span></div>
            </div>
          </section>

          <section>
            <h3 className="text-white/70 text-xs font-medium mb-1">More features</h3>
            <p>
              Hover anywhere to see your next event or focus time remaining in 
              a bottom overlay. Tab title shows countdown. 
              Add <code className="bg-white/5 px-1 py-0.5 rounded text-[10px]">?demo=1</code> to 
              preview the scatter effect.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
