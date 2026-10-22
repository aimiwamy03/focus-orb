import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { FocusLog } from './FocusLog';
import {
  LOG_EMPTY,
  getFocusLogFixture,
  getFocusLogRedesignFixture,
} from '@/lib/focusLog';

const now = new Date(2026, 9, 22, 18, 0, 0, 0);

describe('FocusLog panel', () => {
  it('shows Today empty copy and a visible Close control', () => {
    const onClose = vi.fn();
    render(<FocusLog entries={[]} now={now} onClose={onClose} onPickTask={vi.fn()} />);
    expect(screen.getByTestId('focus-log-day-label-Today').textContent).toBe('Today');
    expect(screen.queryByTestId('focus-log-day-total-Today')).toBeNull();
    expect(screen.getByTestId('focus-log-empty').textContent).toBe(LOG_EMPTY);
    expect(screen.getByTestId('focus-log-close').textContent).toBe('Close');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(window, { key: 'l' });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('moves a highlight through rows and fills a task on click', () => {
    const onPickTask = vi.fn();
    render(
      <FocusLog
        entries={getFocusLogFixture(now)}
        now={now}
        onClose={vi.fn()}
        onPickTask={onPickTask}
      />
    );
    expect(screen.getByTestId('focus-log-day-label-Today').textContent).toBe('Today');
    expect(screen.getByTestId('focus-log-day-total-Today').textContent).toBe('1h 35m');
    expect(screen.queryByTestId('focus-log-by-task')).toBeNull();
    const first = screen.getByTestId('focus-log-row-today-review');
    expect(first.getAttribute('data-highlighted')).toBe('true');
    fireEvent.keyDown(window, { key: 'ArrowDown' });
    expect(screen.getByTestId('focus-log-row-today-voice').getAttribute('data-highlighted')).toBe(
      'true'
    );
    fireEvent.click(screen.getByTestId('focus-log-task-today-spec'));
    expect(onPickTask).toHaveBeenCalledWith('write the spec');
    expect(screen.getByTestId('focus-log-time-today-voice').textContent).toBe('2:10–2:35pm');
    expect(screen.getByTestId('focus-log-duration-today-voice').textContent).toMatch(/25\smin/);
    expect(screen.getByTestId('focus-log-task-today-voice').textContent).toBe('finish voice ai post');
    expect(screen.getByTestId('focus-log-row-today-review').className).not.toMatch(
      /ring-2|rounded-full/
    );
  });

  it('uses start-only time and a planned suffix for stopped-early rows, with no delete control', () => {
    render(
      <FocusLog
        entries={getFocusLogFixture(now)}
        now={now}
        onClose={vi.fn()}
        onPickTask={vi.fn()}
      />
    );
    expect(screen.getByTestId('focus-log-time-today-review').textContent).toBe('4:05pm');
    expect(screen.getByTestId('focus-log-duration-today-review').textContent).toMatch(
      /20\smin\s\/\s50/
    );
    expect(screen.queryByTestId('focus-log-delete-today-review')).toBeNull();
    expect(screen.queryByTestId('focus-log-early-today-review')).toBeNull();
  });

  it('labels Yesterday without a grey date, hides empty other days, and formats 27m and 1h 5m', () => {
    render(
      <FocusLog
        entries={getFocusLogRedesignFixture(now)}
        now={now}
        onClose={vi.fn()}
        onPickTask={vi.fn()}
      />
    );
    expect(screen.getByTestId('focus-log-day-label-Today').textContent).toBe('Today');
    expect(screen.getByTestId('focus-log-empty').textContent).toBe(LOG_EMPTY);
    expect(screen.getByTestId('focus-log-day-label-Yesterday').textContent).toBe('Yesterday');
    expect(screen.getByTestId('focus-log-day-Yesterday').textContent).not.toContain('Wed, Oct 21');
    expect(screen.getByTestId('focus-log-day-total-Yesterday').textContent).toBe('27m');
    expect(screen.getByTestId('focus-log-time-yday-done').textContent).toBe('9:01–9:26pm');
    expect(screen.getByTestId('focus-log-duration-yday-done').textContent).toMatch(/25\smin$/);
    expect(screen.getByTestId('focus-log-time-yday-early-a').textContent).toBe('9:01pm');
    expect(screen.getByTestId('focus-log-duration-yday-early-a').textContent).toMatch(/1\smin\s\/\s25/);
    expect(screen.getByTestId('focus-log-day-label-Tue, Oct 20').textContent).toBe('Tue, Oct 20');
    expect(screen.getByTestId('focus-log-day-total-Tue, Oct 20').textContent).toBe('1h 5m');
    expect(screen.getByTestId('focus-log-day-label-Mon, Oct 19').textContent).toBe('Mon, Oct 19');
    expect(screen.getByTestId('focus-log-task-hour-long').className).toMatch(/focus-log-task/);
  });

  it('charts the last 14 days and shows a tooltip on hover', () => {
    render(
      <FocusLog
        entries={getFocusLogRedesignFixture(now)}
        now={now}
        onClose={vi.fn()}
        onPickTask={vi.fn()}
      />
    );
    expect(screen.getByTestId('focus-log-chart-title').textContent).toBe('Last 14 days');
    expect(screen.getByTestId('focus-log-chart-total').textContent).toBe('1h 57m');
    expect(screen.getByTestId('focus-log-chart-avg').textContent).toBe('Avg 39m a day');
    expect(screen.getByTestId('focus-log-chart-best').textContent).toContain('1h 5m');
    expect(screen.getByTestId('focus-log-chart-max').textContent).toBe('1h 5m');
    expect(screen.getByTestId('focus-log-chart-axis-end').textContent).toBe('Today');
    const bars = document.querySelectorAll('[data-testid^="focus-log-chart-bar-"]');
    expect(bars).toHaveLength(14);
    fireEvent.mouseEnter(screen.getByTestId(`focus-log-chart-bar-${new Date(2026, 9, 20).getTime()}`));
    expect(screen.getByTestId('focus-log-chart-tooltip').textContent).toBe('Tue, Oct 20 · 1h 5m');
    const todayBar = screen.getByTestId(`focus-log-chart-bar-${new Date(2026, 9, 22).getTime()}`);
    fireEvent.focus(todayBar);
    fireEvent.keyDown(todayBar, { key: 'ArrowLeft' });
    expect(screen.getByTestId(`focus-log-chart-bar-${new Date(2026, 9, 21).getTime()}`).getAttribute('data-highlighted')).toBe('true');
  });

  it('shows the empty chart copy when there are no sessions', () => {
    render(<FocusLog entries={[]} now={now} onClose={vi.fn()} onPickTask={vi.fn()} />);
    expect(screen.getByTestId('focus-log-chart-empty').textContent).toBe(
      'Your focus will chart here.'
    );
    expect(screen.queryByTestId('focus-log-chart-total')).toBeNull();
  });
});
