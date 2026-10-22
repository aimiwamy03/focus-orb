'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
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

const LOG_GRID = 'grid w-full min-w-0 grid-cols-[3px_minmax(0,1fr)_auto] items-center gap-x-3';

function rowSurface(active: boolean): string {
  return [
    LOG_GRID,
    'rounded-[4px] py-2',
    active ? 'bg-white/[0.06]' : '',
  ]
    .filter(Boolean)
    .join(' ');
}

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
    <div className="fixed inset-0 min-w-0 overflow-hidden bg-black/80 p-3 z-50">
      <div
        data-testid="focus-log"
        data-interactive
        data-text-clear
        className="flex h-full min-w-0 w-full max-w-full cursor-auto flex-col overflow-hidden rounded-2xl px-4 py-4"
        style={{
          background: 'rgba(255,255,255,0.04)',
          backdropFilter: 'blur(18px)',
        }}
      >
        <div className={`${LOG_GRID} mb-2 shrink-0`}>
          <span aria-hidden />
          <h2
            data-testid="focus-log-title"
            className="min-w-0 break-words text-[length:var(--type-log-heading)] font-semibold leading-tight text-orb-text"
          >
            {LOG_LABEL}
          </h2>
          <button
            type="button"
            data-testid="focus-log-close"
            aria-label="Close"
            onClick={onClose}
            className="shrink-0 justify-self-end px-1 text-[length:var(--type-log-body)] text-orb-quiet hover:text-orb-text"
          >
            Close
          </button>
        </div>

        <div ref={listRef} className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto">
          {entries.length === 0 ? (
            <div className={LOG_GRID}>
              <span aria-hidden />
              <p
                data-testid="focus-log-empty"
                className="col-span-2 min-w-0 break-words text-[length:var(--type-log-body)] leading-snug text-orb-dim"
              >
                {LOG_EMPTY}
              </p>
            </div>
          ) : (
            days.map((day) => (
              <section
                key={day.key}
                data-testid={`focus-log-day-${day.label}`}
                className="mb-3 last:mb-1"
              >
                <div className={`${LOG_GRID} mb-1`}>
                  <span aria-hidden />
                  <h3 className="col-span-2 min-w-0 break-words text-[length:var(--type-log-heading)] font-semibold leading-tight text-orb-text">
                    {day.heading}
                  </h3>
                </div>
                {day.isToday && day.entries.length === 0 ? (
                  <div className={LOG_GRID}>
                    <span aria-hidden />
                    <p
                      data-testid="focus-log-empty"
                      className="col-span-2 min-w-0 break-words text-[length:var(--type-log-body)] text-orb-dim"
                    >
                      {LOG_EMPTY}
                    </p>
                  </div>
                ) : null}
                {day.isToday && day.byTask.length > 0 ? (
                  <div data-testid="focus-log-by-task" className="mb-1">
                    <div className={LOG_GRID}>
                      <span aria-hidden />
                      <div className="col-span-2 text-[length:var(--type-log-body)] text-orb-quiet">
                        {LOG_BY_TASK}
                      </div>
                    </div>
                    {day.byTask.map((item) => (
                      <div
                        key={item.task}
                        data-testid={`focus-log-by-task-${item.task}`}
                        className={`${LOG_GRID} py-0.5 text-[length:var(--type-log-body)] text-orb-dim`}
                      >
                        <span aria-hidden />
                        <button
                          type="button"
                          title={item.task}
                          className="min-w-0 truncate text-left hover:text-orb-text"
                          onClick={() => onPickTask(item.task)}
                        >
                          {item.task}
                        </button>
                        <span className="shrink-0 tabular-nums">{formatDayFocused(item.minutes)}</span>
                      </div>
                    ))}
                  </div>
                ) : null}
                <ul>
                  {day.entries.map((entry) => {
                    const globalIndex = rows.findIndex((row) => row.id === entry.id);
                    const active = globalIndex === index;
                    const pending = pendingId === entry.id;
                    return (
                      <li key={entry.id} className="min-w-0">
                        <div
                          data-testid={`focus-log-row-${entry.id}`}
                          data-highlighted={active ? 'true' : 'false'}
                          className={rowSurface(active)}
                          onMouseEnter={() => setIndex(globalIndex)}
                        >
                          <span
                            aria-hidden
                            data-testid={`focus-log-accent-${entry.id}`}
                            className="h-full min-h-[1.15em] w-[3px] self-stretch rounded-[1px]"
                            style={{
                              backgroundColor: active ? 'var(--color-log-accent)' : 'transparent',
                            }}
                          />
                          <button
                            type="button"
                            data-testid={`focus-log-task-${entry.id}`}
                            title={entry.task}
                            className={`min-w-0 truncate text-left text-[length:var(--type-log-body)] ${
                              active ? 'font-medium text-white' : 'text-orb-text'
                            }`}
                            onClick={() => onPickTask(entry.task)}
                          >
                            {entry.task}
                          </button>
                          <div
                            data-testid={`focus-log-meta-${entry.id}`}
                            className={`flex min-w-0 shrink-0 items-center gap-2 text-[length:var(--type-log-body)] ${
                              active ? 'text-white' : 'text-orb-dim'
                            }`}
                          >
                            <span className="whitespace-nowrap tabular-nums">
                              {formatLogRange(new Date(entry.startMs), new Date(entry.endMs))}
                              {'  '}
                              {formatFocusedMinutes(entry.minutes, entry.planned, entry.ended)}
                            </span>
                            {entry.ended === 'ended-early' ? (
                              <span
                                data-testid={`focus-log-early-${entry.id}`}
                                className="whitespace-nowrap text-orb-quiet"
                              >
                                {LOG_ENDED_EARLY}
                              </span>
                            ) : null}
                            <button
                              type="button"
                              data-testid={`focus-log-delete-${entry.id}`}
                              aria-label="Delete"
                              onClick={() => setPendingId(entry.id)}
                              className="shrink-0 px-0.5 text-orb-quiet hover:text-orb-text"
                            >
                              x
                            </button>
                          </div>
                        </div>
                        {pending ? (
                          <div
                            data-testid="focus-log-delete-confirm"
                            className={`${LOG_GRID} mt-1 text-[length:var(--type-log-body)]`}
                          >
                            <span aria-hidden />
                            <span className="min-w-0 break-words text-orb-dim">{DELETE_LOG_PROMPT}</span>
                            <div className="flex shrink-0 gap-3">
                              <button
                                type="button"
                                data-testid="focus-log-delete-keep"
                                onClick={() => setPendingId(null)}
                                className="text-orb-text"
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
                                className="text-orb-quiet"
                              >
                                {DELETE_LABEL}
                              </button>
                            </div>
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
