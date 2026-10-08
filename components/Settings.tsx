'use client';

import { useState } from 'react';
import { useCalendar } from '@/lib/useCalendar';
import { signInWithGoogle } from '@/app/actions';

interface SettingsProps {
  onClose: () => void;
  onStartFocus: (duration: number) => void;
}

export function Settings({ onClose, onStartFocus }: SettingsProps) {
  const { 
    calendarUrl, 
    setCalendarUrl, 
    scatterWindow, 
    setScatterWindow,
    authMethod,
    selectAuthMethod,
    isGoogleConnected,
    disconnectGoogle,
  } = useCalendar();
  const [tempUrl, setTempUrl] = useState(calendarUrl);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  const handleSave = () => {
    setCalendarUrl(tempUrl);
    selectAuthMethod('ical');
    onClose();
  };

  const handleGoogleConnect = async () => {
    setIsConnecting(true);
    try {
      await signInWithGoogle();
      selectAuthMethod('google');
    } catch (error) {
      console.error('Failed to connect:', error);
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    await disconnectGoogle();
  };

  const isConfigured = process.env.NEXT_PUBLIC_GOOGLE_CONFIGURED === 'true';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-zinc-900 rounded-lg p-6 max-w-md w-full mx-4 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white">Settings</h2>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white transition-colors"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Google Calendar */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-zinc-300">
            Google Calendar
          </label>
          {isGoogleConnected ? (
            <div className="space-y-2">
              <div className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-white text-sm">
                ✓ Connected
              </div>
              <button
                onClick={handleDisconnect}
                className="w-full px-3 py-2 bg-zinc-800 text-white rounded hover:bg-zinc-700 transition-colors text-sm"
              >
                Disconnect
              </button>
            </div>
          ) : isConfigured ? (
            <button
              onClick={handleGoogleConnect}
              disabled={isConnecting}
              className="w-full px-4 py-2 bg-white text-black rounded font-medium hover:bg-zinc-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isConnecting ? 'Connecting...' : 'Connect Google Calendar'}
            </button>
          ) : (
            <div className="px-3 py-2 bg-zinc-800/50 border border-zinc-700/50 rounded text-zinc-500 text-xs">
              Google Calendar integration not configured
            </div>
          )}
        </div>

        {/* Advanced: iCal URL */}
        {!isGoogleConnected && (
          <div className="space-y-2">
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-sm text-zinc-400 hover:text-zinc-300 transition-colors"
            >
              {showAdvanced ? '▼' : '▶'} Other ways to connect
            </button>
            
            {showAdvanced && (
              <div className="space-y-2 pl-4 border-l border-zinc-700">
                <label className="text-sm font-medium text-zinc-400">
                  iCal URL (Advanced)
                </label>
                <input
                  type="text"
                  value={tempUrl}
                  onChange={(e) => setTempUrl(e.target.value)}
                  placeholder="Paste secret iCal URL here..."
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-white/20 text-sm"
                />
                <p className="text-xs text-zinc-500">
                  Find this in Google Calendar → Settings → Integrate calendar → Secret address in iCal format
                </p>
                <button
                  onClick={handleSave}
                  className="w-full px-4 py-2 bg-zinc-800 text-white rounded hover:bg-zinc-700 transition-colors text-sm"
                >
                  Save iCal URL
                </button>
              </div>
            )}
          </div>
        )}

        {/* Scatter Window */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-zinc-300">
            Scatter window (minutes before meeting)
          </label>
          <div className="flex gap-2">
            {[15, 30, 60, 90].map((minutes) => (
              <button
                key={minutes}
                onClick={() => setScatterWindow(minutes)}
                className={`flex-1 px-3 py-2 rounded transition-colors ${
                  scatterWindow === minutes
                    ? 'bg-white text-black'
                    : 'bg-zinc-800 text-white hover:bg-zinc-700'
                }`}
              >
                {minutes}m
              </button>
            ))}
          </div>
        </div>

        {/* Manual Focus */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-zinc-300">
            Start manual focus block
          </label>
          <div className="flex gap-2">
            {[25, 50, 90].map((minutes) => (
              <button
                key={minutes}
                onClick={() => {
                  onStartFocus(minutes);
                  onClose();
                }}
                className="flex-1 px-3 py-2 bg-zinc-800 text-white rounded hover:bg-zinc-700 transition-colors"
              >
                {minutes}m
              </button>
            ))}
          </div>
        </div>

        {/* Keyboard shortcuts */}
        <div className="pt-4 border-t border-zinc-800 space-y-1">
          <p className="text-xs font-medium text-zinc-400">Keyboard shortcuts</p>
          <div className="text-xs text-zinc-500 space-y-1">
            <div><kbd className="bg-zinc-800 px-1.5 py-0.5 rounded">f</kbd> fullscreen</div>
            <div><kbd className="bg-zinc-800 px-1.5 py-0.5 rounded">s</kbd> settings</div>
            <div><kbd className="bg-zinc-800 px-1.5 py-0.5 rounded">space</kbd> start/stop focus</div>
          </div>
        </div>
      </div>
    </div>
  );
}
