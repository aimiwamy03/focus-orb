import { afterEach, describe, it, expect, vi } from 'vitest';
import type { ComponentProps } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { FocusPrompt } from './FocusPrompt';
import { FALLBACK_TASK, MENU_ASK_HINT, type PromptSurface } from '@/lib/focusPrompt';

afterEach(() => cleanup());

const recents = ['finish voice ai post', 'write the spec', 'review pr', 'ship'];

function renderPrompt(
  surface: PromptSurface,
  extra: Partial<ComponentProps<typeof FocusPrompt>> = {}
) {
  const handlers = {
    onTaskChange: vi.fn(),
    onChoiceChange: vi.fn(),
    onStart: vi.fn(),
    onKeepGoing: vi.fn(),
    onEnd: vi.fn(),
    onBreak: vi.fn(),
    onAnotherRound: vi.fn(),
    onJoin: vi.fn(),
    onSkip: vi.fn(),
    onOpenSession: vi.fn(),
    onKeepSession: vi.fn(),
    onEndSession: vi.fn(),
    onOpenLog: vi.fn(),
  };
  render(
    <FocusPrompt
      surface={surface}
      contextLine="Clear for the rest of the day."
      task={extra.task ?? ''}
      onTaskChange={handlers.onTaskChange}
      recentTasks={recents}
      choice={50}
      onChoiceChange={handlers.onChoiceChange}
      untilMinutes={null}
      focusMinutes={null}
      completedTask="Write the spec"
      completedMinutes={50}
      joinUrl={surface === 'meeting-soon' ? 'https://meet.google.com/abc-defg-hij' : null}
      onStart={handlers.onStart}
      onKeepGoing={handlers.onKeepGoing}
      onEnd={handlers.onEnd}
      onBreak={handlers.onBreak}
      onAnotherRound={handlers.onAnotherRound}
      onJoin={handlers.onJoin}
      onSkip={handlers.onSkip}
      onOpenSession={handlers.onOpenSession}
      onKeepSession={handlers.onKeepSession}
      onEndSession={handlers.onEndSession}
      onOpenLog={handlers.onOpenLog}
      chromeVisible
      {...extra}
    />
  );
  return handlers;
}

function renderAsk(task = '') {
  return renderPrompt('ask', { task });
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

  it('shows the idle Ask menu hint near the chips', () => {
    renderAsk('');
    expect(screen.getByTestId('menu-hint').getAttribute('aria-label')).toBe(MENU_ASK_HINT);
    expect(screen.getByTestId('duration-50m').getAttribute('data-highlighted')).toBe('true');
  });
});

describe('game-menu rows', () => {
  it('highlights End after Right and confirms it with Enter', () => {
    const { onEnd, onKeepGoing } = renderPrompt('stop-confirm');
    expect(screen.getByTestId('keep-going').getAttribute('data-highlighted')).toBe('true');
    expect(screen.getByTestId('end-focus').getAttribute('data-highlighted')).toBe('false');
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(screen.getByTestId('end-focus').getAttribute('data-highlighted')).toBe('true');
    expect(screen.getByTestId('keep-going').getAttribute('data-highlighted')).toBe('false');
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(onKeepGoing).not.toHaveBeenCalled();
  });

  it('treats Escape as Keep going', () => {
    const { onKeepGoing, onEnd } = renderPrompt('stop-confirm');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onKeepGoing).toHaveBeenCalledTimes(1);
    expect(onEnd).not.toHaveBeenCalled();
  });

  it('opens the log from the completed status line', () => {
    const { onOpenLog } = renderPrompt('completed');
    screen.getByTestId('focus-completed').click();
    expect(onOpenLog).toHaveBeenCalledTimes(1);
  });

  it('defaults completed to Another round', () => {
    const { onAnotherRound, onBreak } = renderPrompt('completed');
    expect(screen.getByTestId('another-round').getAttribute('data-highlighted')).toBe('true');
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(onAnotherRound).toHaveBeenCalledTimes(1);
    expect(onBreak).not.toHaveBeenCalled();
  });

  it('moves duration chips with arrows and starts on Enter', () => {
    const { onChoiceChange, onStart } = renderPrompt('ask');
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(screen.getByTestId('duration-90m').getAttribute('data-highlighted')).toBe('true');
    expect(onChoiceChange).toHaveBeenCalledWith(90);
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it('lets empty-input arrows move chips and reach Start', () => {
    const { onStart } = renderAsk('');
    const input = screen.getByTestId('focus-task') as HTMLInputElement;
    input.focus();
    fireEvent.keyDown(input, { key: 'ArrowRight' });
    expect(screen.getByTestId('duration-90m').getAttribute('data-highlighted')).toBe('true');
    fireEvent.keyDown(input, { key: 'ArrowRight' });
    expect(screen.getByTestId('focus-start').getAttribute('data-highlighted')).toBe('true');
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it('cancels the Ask field on Escape', () => {
    renderAsk('');
    const input = screen.getByTestId('focus-task') as HTMLInputElement;
    input.focus();
    expect(document.activeElement).toBe(input);
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(document.activeElement).not.toBe(input);
  });

  it('offers End session on a break and confirms from the prompt', () => {
    const { onOpenSession } = renderPrompt('break', { focusMinutes: 5 });
    expect(screen.getByTestId('focus-break').textContent).toBe('Break 5m');
    expect(screen.getByTestId('end-session').textContent).toBe('End session');
    expect(screen.getByTestId('end-session').getAttribute('data-highlighted')).toBe('true');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onOpenSession).toHaveBeenCalledTimes(1);
  });

  it('defaults End session confirm to Keep resting and Ends on Right then Enter', () => {
    const { onKeepSession, onEndSession } = renderPrompt('session-confirm');
    expect(screen.getByTestId('end-session-prompt').textContent).toBe('End session?');
    expect(screen.getByTestId('keep-session').getAttribute('data-highlighted')).toBe('true');
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(screen.getByTestId('end-session').getAttribute('data-highlighted')).toBe('true');
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(onEndSession).toHaveBeenCalledTimes(1);
    expect(onKeepSession).not.toHaveBeenCalled();
  });

  it('joins from the meeting prompt and skips on Escape', () => {
    const { onJoin, onSkip } = renderPrompt('meeting-soon');
    expect(screen.getByTestId('join-meeting').getAttribute('data-highlighted')).toBe('true');
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(onJoin).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onSkip).toHaveBeenCalledTimes(1);
  });
});
