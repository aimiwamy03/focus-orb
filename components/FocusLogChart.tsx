'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CHART_EMPTY,
  CHART_TITLE,
  chartBarHeight,
  chartFocusDays,
  formatChartAvg,
  formatChartBest,
  formatChartTooltip,
  formatDayFocused,
  summarizeChart,
  type FocusLogEntry,
} from '@/lib/focusLog';

export function FocusLogChart({
  entries,
  now = new Date(),
}: {
  entries: FocusLogEntry[];
  now?: Date;
}) {
  const days = useMemo(() => chartFocusDays(entries, now), [entries, now]);
  const summary = useMemo(() => summarizeChart(days), [days]);
  const [active, setActive] = useState<number | null>(null);
  const [focused, setFocused] = useState(false);
  const barRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    if (!focused || active == null) return;
    barRefs.current[active]?.focus();
  }, [active, focused]);

  const tipDay = active != null ? days[active] : null;

  return (
    <aside data-testid="focus-log-chart" className="focus-log-chart">
      <div className="focus-log-day-header">
        <h3 data-testid="focus-log-chart-title" className="focus-log-day-label">
          {CHART_TITLE}
        </h3>
        {summary.hasData ? (
          <span data-testid="focus-log-chart-total" className="focus-log-day-total">
            {formatDayFocused(summary.total)}
          </span>
        ) : null}
      </div>
      <hr className="focus-log-day-rule" />
      {summary.hasData && summary.best ? (
        <p className="focus-log-chart-summary">
          <span data-testid="focus-log-chart-avg">{formatChartAvg(summary.average)}</span>
          <span data-testid="focus-log-chart-best">{formatChartBest(summary.best)}</span>
        </p>
      ) : null}
      {summary.hasData ? (
        <span data-testid="focus-log-chart-max" className="focus-log-chart-max">
          {formatDayFocused(summary.max)}
        </span>
      ) : null}
      <div className="focus-log-chart-plot" data-testid="focus-log-chart-plot">
        {summary.hasData ? (
          <>
            {days.map((day, index) => {
              const height = chartBarHeight(day.minutes, summary.max);
              const isActive = active === index;
              return (
                <button
                  key={day.key}
                  ref={(node) => {
                    barRefs.current[index] = node;
                  }}
                  type="button"
                  tabIndex={isActive || (active == null && day.isToday) ? 0 : -1}
                  data-testid={`focus-log-chart-bar-${day.key}`}
                  data-today={day.isToday ? 'true' : 'false'}
                  data-empty={day.minutes <= 0 ? 'true' : 'false'}
                  data-highlighted={isActive ? 'true' : 'false'}
                  aria-label={formatChartTooltip(day.date, day.minutes)}
                  className="focus-log-chart-bar"
                  onMouseEnter={() => setActive(index)}
                  onMouseLeave={() => {
                    if (!focused) setActive(null);
                  }}
                  onFocus={() => {
                    setFocused(true);
                    setActive(index);
                  }}
                  onBlur={(event) => {
                    const next = event.relatedTarget;
                    if (next instanceof Node && event.currentTarget.parentElement?.contains(next)) {
                      return;
                    }
                    setFocused(false);
                    setActive(null);
                  }}
                  onKeyDown={(event) => {
                    if (
                      event.key !== 'ArrowLeft' &&
                      event.key !== 'ArrowRight' &&
                      event.key !== 'ArrowUp' &&
                      event.key !== 'ArrowDown'
                    ) {
                      return;
                    }
                    event.preventDefault();
                    event.stopPropagation();
                    const dir = event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1;
                    const next = (index + dir + days.length) % days.length;
                    setFocused(true);
                    setActive(next);
                  }}
                >
                  <span
                    className="focus-log-chart-bar-fill"
                    style={{
                      height,
                      background:
                        day.minutes <= 0
                          ? '#3a3a40'
                          : day.isToday
                            ? 'oklch(0.88 0.11 230)'
                            : 'oklch(0.78 0.08 230)',
                    }}
                  />
                </button>
              );
            })}
            {tipDay ? (
              <span data-testid="focus-log-chart-tooltip" className="focus-log-chart-tooltip">
                {formatChartTooltip(tipDay.date, tipDay.minutes)}
              </span>
            ) : null}
          </>
        ) : (
          <>
            <span className="focus-log-chart-baseline" aria-hidden />
            <span data-testid="focus-log-chart-empty" className="focus-log-chart-empty">
              {CHART_EMPTY}
            </span>
          </>
        )}
      </div>
      <div className="focus-log-chart-axis">
        <span data-testid="focus-log-chart-axis-start">{days[0]?.label}</span>
        <span data-testid="focus-log-chart-axis-mid">
          {days[Math.floor((days.length - 1) / 2)]?.label}
        </span>
        <span data-testid="focus-log-chart-axis-end">Today</span>
      </div>
    </aside>
  );
}
