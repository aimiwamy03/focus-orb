import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { FocusLog } from './FocusLog';
import { LOG_EMPTY, getFocusLogFixture } from '@/lib/focusLog';

const now = new Date(2026, 9, 22, 18, 0, 0, 0);

describe('FocusLog panel', () => {
  it('shows the empty state and a visible close control', () => {
    const onClose = vi.fn();
    render(
      <FocusLog entries={[]} now={now} onClose={onClose} onPickTask={vi.fn()} onDelete={vi.fn()} />
    );
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
        onDelete={vi.fn()}
      />
    );
    expect(screen.getByTestId('focus-log-day-Today').textContent).toContain('Today, 1h 35m focused');
    expect(screen.getByTestId('focus-log-by-task').textContent).toContain('write the spec');
    const first = screen.getByTestId('focus-log-row-today-review');
    expect(first.getAttribute('data-highlighted')).toBe('true');
    fireEvent.keyDown(window, { key: 'ArrowDown' });
    expect(screen.getByTestId('focus-log-row-today-voice').getAttribute('data-highlighted')).toBe(
      'true'
    );
    fireEvent.click(screen.getByTestId('focus-log-task-today-spec'));
    expect(onPickTask).toHaveBeenCalledWith('write the spec');
    expect(screen.getByTestId('focus-log-meta-today-voice').textContent).toContain('2:10-2:35pm');
    expect(screen.getByTestId('focus-log-meta-today-voice').textContent).toMatch(/25\smin/);
    expect(screen.getByTestId('focus-log-task-today-voice').textContent).toBe('finish voice ai post');
    expect(screen.getByTestId('focus-log-row-today-review').className).not.toMatch(/ring-2|rounded-full/);
  });

  it('asks before deleting a row and only tags ended-early sessions', () => {
    const onDelete = vi.fn();
    render(
      <FocusLog
        entries={getFocusLogFixture(now)}
        now={now}
        onClose={vi.fn()}
        onPickTask={vi.fn()}
        onDelete={onDelete}
      />
    );
    expect(screen.getByTestId('focus-log-early-today-review').textContent).toBe('ended early');
    expect(screen.queryByTestId('focus-log-early-today-voice')).toBeNull();
    fireEvent.click(screen.getByTestId('focus-log-delete-today-review'));
    expect(screen.getByTestId('focus-log-delete-confirm').textContent).toContain('Delete this session?');
    fireEvent.click(screen.getByTestId('focus-log-delete-keep'));
    expect(onDelete).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('focus-log-delete-today-review'));
    fireEvent.click(screen.getByTestId('focus-log-delete-yes'));
    expect(onDelete).toHaveBeenCalledWith('today-review');
  });
});
