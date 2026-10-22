'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { choiceClass } from './ChoiceRow';
import {
  DELETE_LABEL,
  DELETE_LOG_PROMPT,
  KEEP_LOG_LABEL,
  LOG_BY_TASK,
  LOG_EMPTY,
  LOG_ENDED_EARLY,
  LOG_LABEL,
  formatDayFocused,
  formatFocusedMinutes,
  formatLogRange,
  type FocusLogEntry,
  groupFocusLog,
} from '@/lib/focusLog';

export function FocusLog({
  entries,
  now = new Date(),
  onClose,
  onPickTask,
  onDelete,
}: {
  entries: FocusLogEntry[];
  now?: Date;
  onClose: () => void;
  onPickTask: (task: string) => void;
  onDelete: (id: string) => void;
}) {
  const days = useMemo(() => groupFocusLog(entries, now), [entries, now]);
  const rows = useMemo(() => days.flatMap((day) => day.entries), [days]);
  const [index, setIndex] = useState(0);
  const [pendingId, setPendingId] = useState<string | null>(null);
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
        if (pendingId && event.key === 'Escape') {
          setPendingId(null);
          return;
        }
        onClose();
        return;
      }
      if (rows.length === 0) return;
      if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
        event.preventDefault();
        setIndex((current) => (current + 1) % rows.length);
      } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
        event.preventDefault();
        setIndex((current) => (current - 1 + rows.length) % rows.length);
      } else if (event.key === 'Enter' && pendingId) {
        event.preventDefault();
        onDelete(pendingId);
        setPendingId(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, onDelete, pendingId, rows.length]);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 p-3 sm:p-6">
      <div
        data-testid="focus-log"
        data-interactive
        data-text-clear
        className="flex h-full w-full cursor-auto flex-col overflow-hidden rounded-2xl px-5 py-5 sm:px-8 sm:py-6"
        style={{
          background: 'rgba(255,255,255,0.04)',
          backdropFilter: 'blur(18px)',
        }}
      >
        <div className="mb-3 flex shrink-0 items-start justify-between gap-3">
          <h2
            data-testid="focus-log-title"
            className="text-[length:var(--type-log-heading)] font-semibold leading-tight text-orb-text"
          >
            {LOG_LABEL}
          </h2>
          <button
            type="button"
            data-testid="focus-log-close"
            aria-label="Close"
            onClick={onClose}
            className="rounded-full px-3 py-1 text-[length:var(--type-log-body)] text-orb-quiet hover:text-orb-text"
          >
            Close
          </button>
        </div>

        <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto pr-1">
          {entries.length === 0 ? (
            <p
              data-testid="focus-log-empty"
              className="text-[length:var(--type-log-body)] leading-snug text-orb-dim"
            >
              {LOG_EMPTY}
            </p>
          ) : (
            days.map((day) => (
              <section key={day.key} data-testid={`focus-log-day-${day.label}`} className="mb-4 last:mb-2">
                <h3 className="text-[length:var(--type-log-heading)] font-semibold leading-tight text-orb-text">
                  {day.heading}
                </h3>
                {day.isToday && day.entries.length === 0 ? (
                  <p
                    data-testid="focus-log-empty"
                    className="mt-2 text-[length:var(--type-log-body)] text-orb-dim"
                  >
                    {LOG_EMPTY}
                  </p>
                ) : null}
                {day.isToday && day.byTask.length > 0 ? (
                  <div data-testid="focus-log-by-task" className="mt-2">
                    <div className="text-[length:var(--type-log-body)] text-orb-quiet">{LOG_BY_TASK}</div>
                    <ul className="mt-1 space-y-0.5">
                      {day.byTask.map((item) => (
                        <li
                          key={item.task}
                          className="flex justify-between gap-3 text-[length:var(--type-log-body)] text-orb-dim"
                        >
                          <button
                            type="button"
                            className="min-w-0 truncate text-left hover:text-orb-text"
                            onClick={() => onPickTask(item.task)}
                          >
                            {item.task}
                          </button>
                          <span>{formatDayFocused(item.minutes)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                <ul className="mt-2 space-y-1.5">
                  {day.entries.map((entry) => {
                    const globalIndex = rows.findIndex((row) => row.id === entry.id);
                    const active = globalIndex === index;
                    const pending = pendingId === entry.id;
                    return (
                      <li key={entry.id}>
                        <div
                          data-testid={`focus-log-row-${entry.id}`}
                          data-highlighted={active ? 'true' : 'false'}
                          className={`${choiceClass('button', active, false)} flex w-full items-start justify-between gap-3 px-3 py-1.5 text-left`}
                          onMouseEnter={() => setIndex(globalIndex)}
                        >
                          <button
                            type="button"
                            data-testid={`focus-log-task-${entry.id}`}
                            className="min-w-0 flex-1 text-left"
                            onClick={() => onPickTask(entry.task)}
                          >
                            <div className="truncate text-[length:var(--type-log-body)] font-medium text-orb-text">
                              {entry.task}
                            </div>
                            <div className="mt-0.5 text-[length:var(--type-log-body)] text-orb-dim">
                              {formatLogRange(new Date(entry.startMs), new Date(entry.endMs))}
                              {' · '}
                              {formatFocusedMinutes(entry.minutes, entry.planned, entry.ended)}
                              {entry.ended === 'ended-early' ? (
                                <span
                                  data-testid={`focus-log-early-${entry.id}`}
                                  className="ml-2 text-orb-quiet"
                                >
                                  {LOG_ENDED_EARLY}
                                </span>
                              ) : null}
                            </div>
                          </button>
                          <button
                            type="button"
                            data-testid={`focus-log-delete-${entry.id}`}
                            aria-label="Delete"
                            onClick={() => setPendingId(entry.id)}
                            className="shrink-0 px-1 text-[length:var(--type-log-body)] text-orb-quiet hover:text-orb-text"
                          >
                            x
                          </button>
                        </div>
                        {pending ? (
                          <div
                            data-testid="focus-log-delete-confirm"
                            className="mt-2 flex flex-wrap items-center justify-end gap-3 text-[length:var(--type-log-body)]"
                          >
                            <span className="text-orb-dim">{DELETE_LOG_PROMPT}</span>
                            <button
                              type="button"
                              data-testid="focus-log-delete-keep"
                              onClick={() => setPendingId(null)}
                              className={choiceClass('quiet', true, false)}
                            >
                              {KEEP_LOG_LABEL}
                            </button>
                            <button
                              type="button"
                              data-testid="focus-log-delete-yes"
                              onClick={() => {
                                onDelete(entry.id);
                                setPendingId(null);
                              }}
                              className={choiceClass('quiet', false, false)}
                            >
                              {DELETE_LABEL}
                            </button>
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
