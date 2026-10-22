'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  LOG_EMPTY,
  LOG_LABEL,
  formatDayFocused,
  formatSessionPlannedSuffix,
  formatSessionSpent,
  formatSessionTime,
  isStoppedEarly,
  sessionBarPercent,
  type FocusLogEntry,
  groupFocusLog,
} from '@/lib/focusLog';
import { FocusLogChart } from './FocusLogChart';

export function FocusLog({
  entries,
  now = new Date(),
  onClose,
  onPickTask,
}: {
  entries: FocusLogEntry[];
  now?: Date;
  onClose: () => void;
  onPickTask: (task: string) => void;
}) {
  const days = useMemo(() => groupFocusLog(entries, now), [entries, now]);
  const rows = useMemo(() => days.flatMap((day) => day.entries), [days]);
  const [index, setIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIndex((current) => {
      if (rows.length === 0) return 0;
      return Math.min(current, rows.length - 1);
    });
  }, [rows.length]);

  useEffect(() => {
    const scroll = () => {
      const row = rows[index];
      if (!row) return;
      const node = listRef.current?.querySelector(`[data-testid="focus-log-row-${row.id}"]`);
      node?.scrollIntoView({ block: 'nearest' });
    };
    scroll();
    window.addEventListener('resize', scroll);
    return () => window.removeEventListener('resize', scroll);
  }, [index, rows]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === 'Escape' || event.key === 'l' || event.key === 'L') {
        event.preventDefault();
        onClose();
        return;
      }
      if (rows.length === 0) return;
      if ((event.target as HTMLElement | null)?.closest?.('[data-testid="focus-log-chart"]')) {
        return;
      }
      if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
        event.preventDefault();
        setIndex((current) => (current + 1) % rows.length);
      } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
        event.preventDefault();
        setIndex((current) => (current - 1 + rows.length) % rows.length);
      } else if (event.key === 'Enter') {
        event.preventDefault();
        const row = rows[index];
        if (row) onPickTask(row.task);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, onClose, onPickTask, rows]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4">
      <div
        data-testid="focus-log"
        data-interactive
        data-text-clear
        className="focus-log flex max-h-[min(90vh,calc(100dvh-2rem))] min-h-0 cursor-auto flex-col overflow-hidden"
      >
        <div className="focus-log-title-row shrink-0">
          <h2 data-testid="focus-log-title" className="focus-log-title">
            {LOG_LABEL}
          </h2>
          <button
            type="button"
            data-testid="focus-log-close"
            aria-label="Close"
            onClick={onClose}
            className="focus-log-close"
          >
            Close
          </button>
        </div>

        <div className="focus-log-body">
        <div ref={listRef} className="focus-log-days min-h-0 overflow-x-hidden overflow-y-auto">
          {days.map((day) => (
            <section
              key={day.key}
              data-testid={`focus-log-day-${day.label}`}
              className="focus-log-day"
            >
              <div className="focus-log-day-header">
                <h3 data-testid={`focus-log-day-label-${day.label}`} className="focus-log-day-label">
                  {day.label}
                </h3>
                {day.entries.length > 0 ? (
                  <span
                    data-testid={`focus-log-day-total-${day.label}`}
                    className="focus-log-day-total"
                  >
                    {formatDayFocused(day.minutes)}
                  </span>
                ) : null}
              </div>
              <hr className="focus-log-day-rule" />
              {day.isToday && day.entries.length === 0 ? (
                <p data-testid="focus-log-empty" className="focus-log-empty">
                  {LOG_EMPTY}
                </p>
              ) : null}
              {day.entries.length > 0 ? (
                <ul>
                  {day.entries.map((entry) => {
                    const globalIndex = rows.findIndex((row) => row.id === entry.id);
                    const active = globalIndex === index;
                    const stopped = isStoppedEarly(entry.ended);
                    const fill = sessionBarPercent(entry.minutes, entry.planned);
                    return (
                      <li key={entry.id} className="min-w-0">
                        <div
                          data-testid={`focus-log-row-${entry.id}`}
                          data-highlighted={active ? 'true' : 'false'}
                          className="focus-log-row"
                          onMouseEnter={() => setIndex(globalIndex)}
                        >
                          <span
                            data-testid={`focus-log-time-${entry.id}`}
                            className="focus-log-time"
                          >
                            {formatSessionTime(
                              new Date(entry.startMs),
                              new Date(entry.endMs),
                              entry.ended
                            )}
                          </span>
                          <button
                            type="button"
                            data-testid={`focus-log-task-${entry.id}`}
                            title={entry.task}
                            className="focus-log-task"
                            onClick={() => onPickTask(entry.task)}
                          >
                            {entry.task}
                          </button>
                          <div
                            data-testid={`focus-log-meta-${entry.id}`}
                            className="focus-log-duration"
                          >
                            <span
                              data-testid={`focus-log-bar-${entry.id}`}
                              className="focus-log-bar"
                              aria-hidden
                            >
                              <span
                                style={{
                                  width: `${fill}%`,
                                  background: stopped ? '#6e6e74' : 'oklch(0.78 0.08 230)',
                                }}
                              />
                            </span>
                            <span
                              data-testid={`focus-log-duration-${entry.id}`}
                              className={`focus-log-duration-label${
                                stopped ? ' focus-log-duration-early' : ''
                              }`}
                            >
                              {formatSessionSpent(entry.minutes)}
                              {stopped ? (
                                <span className="focus-log-duration-planned">
                                  {formatSessionPlannedSuffix(entry.planned)}
                                </span>
                              ) : null}
                            </span>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </section>
          ))}
        </div>
        <FocusLogChart entries={entries} now={now} />
        </div>
      </div>
    </div>
  );
}
