import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FocusPrompt } from './FocusPrompt';
import { FALLBACK_TASK } from '@/lib/focusPrompt';

const recents = ['finish voice ai post', 'write the spec', 'review pr', 'ship'];

function renderAsk(task = '') {
  const onTaskChange = vi.fn();
  render(
    <FocusPrompt
      surface="ask"
      contextLine="Clear for the rest of the day."
      task={task}
      onTaskChange={onTaskChange}
      recentTasks={recents}
      choice={50}
      onChoiceChange={() => {}}
      untilMinutes={null}
      focusMinutes={null}
      onStart={() => {}}
      onKeepGoing={() => {}}
      onEnd={() => {}}
      onBreak={() => {}}
      onAnotherRound={() => {}}
    />
  );
  return { onTaskChange };
}

describe('Ask task field', () => {
  it('starts empty with a Focus placeholder and up to three recents', () => {
    renderAsk('');
    const input = screen.getByTestId('focus-task') as HTMLInputElement;
    expect(input.value).toBe('');
    expect(input.placeholder).toBe(FALLBACK_TASK);
    expect(screen.getByTestId('recent-finish voice ai post')).toBeTruthy();
    expect(screen.getByTestId('recent-write the spec')).toBeTruthy();
    expect(screen.getByTestId('recent-review pr')).toBeTruthy();
    expect(screen.queryByTestId('recent-ship')).toBeNull();
  });

  it('hides a suggestion that matches the typed value and fills on click', () => {
    const { onTaskChange } = renderAsk('finish voice ai post');
    expect(screen.queryByTestId('recent-finish voice ai post')).toBeNull();
    screen.getByTestId('recent-write the spec').click();
    expect(onTaskChange).toHaveBeenCalledWith('write the spec');
  });
});
