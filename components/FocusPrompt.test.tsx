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
      choice={extra.choice ?? 50}
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

  it('keeps a matching suggestion visible and fills the input on click', () => {
    const { onTaskChange } = renderAsk('finish voice ai post');
    expect(screen.getByTestId('recent-finish voice ai post').getAttribute('data-highlighted')).toBe(
      'true'
    );
    expect(screen.getByTestId('recent-write the spec').getAttribute('data-highlighted')).toBe(
      'false'
    );
    screen.getByTestId('recent-write the spec').click();
    expect(onTaskChange).toHaveBeenCalledWith('write the spec');
  });

  it('renders suggestions as plain text without a pill', () => {
    renderAsk('');
    const suggestion = screen.getByTestId('recent-finish voice ai post');
    expect(suggestion.className).toBe('ask-suggestion');
    expect(suggestion.className).not.toMatch(/rounded-full|ring-2|bg-orb-highlight/);
    expect(screen.getByTestId('recent-tasks').className).toBe('ask-suggestions');
  });

  it('shows the idle Ask menu hint near the chips', () => {
    renderAsk('');
    expect(screen.getByTestId('menu-hint').getAttribute('aria-label')).toBe(MENU_ASK_HINT);
    expect(screen.getByTestId('duration-50m').getAttribute('data-highlighted')).toBe('true');
  });

  it('anchors the empty caret to a start-aligned Focus placeholder', () => {
    renderAsk('');
    const input = screen.getByTestId('focus-task') as HTMLInputElement;
    expect(screen.getByTestId('focus-task-placeholder').textContent).toBe(FALLBACK_TASK);
    expect(screen.getByTestId('ask-task-field').getAttribute('data-value')).toBe(FALLBACK_TASK);
    expect(input.className).toBe('ask-task');
    expect(input.className).not.toMatch(/text-center/);
    expect(input.size).toBe(1);
  });

  it('hides the Focus placeholder once she types', () => {
    renderAsk('write the spec');
    expect(screen.queryByTestId('focus-task-placeholder')).toBeNull();
    expect((screen.getByTestId('focus-task') as HTMLInputElement).value).toBe('write the spec');
  });

  it('fills the empty task from yesterday chips and keeps the landing calm', () => {
    const { onTaskChange } = renderPrompt('ask', {
      task: '',
      returnLine: '50m today · 3 day streak',
      yesterdayTask: 'finish voice ai post',
      yesterdayNote: 'Send the recap',
    });
    expect(screen.getByTestId('return-line').textContent).toBe('50m today · 3 day streak');
    expect(screen.getByTestId('return-line').textContent).not.toMatch(/[—–]/);
    expect(screen.queryByTestId('recent-tasks')).toBeNull();
    expect(screen.getByTestId('ask-yesterday-task').className).not.toMatch(/rounded-full|bg-orb-highlight/);
    screen.getByTestId('ask-yesterday-task').click();
    expect(onTaskChange).toHaveBeenCalledWith('finish voice ai post');
    screen.getByTestId('ask-yesterday-note').click();
    expect(onTaskChange).toHaveBeenCalledWith('Send the recap');
  });

  it('hides yesterday chips once the task box has text', () => {
    renderPrompt('ask', { task: 'already filled', yesterdayTask: 'finish voice ai post' });
    expect(screen.queryByTestId('ask-yesterday')).toBeNull();
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

  it('shows the focused-today line, next-step note, and ratings after bloom', () => {
    const onNextStepChange = vi.fn();
    const onFocusRating = vi.fn();
    renderPrompt('completed', {
      focusedToday: '1h 45m focused today.',
      nextStep: '',
      onNextStepChange,
      onFocusRating,
    });
    expect(screen.getByTestId('focused-today').textContent).toBe('1h 45m focused today.');
    expect(screen.getByTestId('focused-today').textContent).not.toMatch(/[—–]/);
    fireEvent.change(screen.getByTestId('next-step'), { target: { value: 'Write the recap' } });
    expect(onNextStepChange).toHaveBeenCalledWith('Write the recap');
    expect(screen.queryByTestId('distracted-prompt')).toBeNull();
    expect(screen.queryByTestId('distract-yes')).toBeNull();
    expect(screen.queryByTestId('distract-no')).toBeNull();
    expect(screen.queryByText('Did the orb distract you?')).toBeNull();
    fireEvent.click(screen.getByTestId('rating-4'));
    expect(onFocusRating).toHaveBeenCalledWith(4);
    const note = screen.getByTestId('next-step');
    expect(note.tagName).toBe('TEXTAREA');
    expect(note.getAttribute('rows')).toBe('1');
    expect(note.className).toBe('next-step');
    expect(note.className).not.toMatch(/rounded-full|py-1/);
  });

  it('hides the note form while the bloom is playing', () => {
    renderPrompt('completed', { focusedToday: '1h 45m focused today.', blooming: true });
    expect(screen.getByTestId('focused-today')).toBeTruthy();
    expect(screen.queryByTestId('focus-completed')).toBeNull();
    expect(screen.queryByTestId('next-step')).toBeNull();
  });

  it('defaults completed to Start another and labels Take a break without pills', () => {
    const { onAnotherRound, onBreak } = renderPrompt('completed');
    expect(screen.getByTestId('take-break').textContent).toBe('Take a break');
    expect(screen.getByTestId('another-round').getAttribute('data-highlighted')).toBe('true');
    expect(screen.getByTestId('another-round').textContent).not.toMatch(/[—–]/);
    expect(screen.getByTestId('take-break').className).not.toMatch(/rounded-full/);
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(onAnotherRound).toHaveBeenCalledTimes(1);
    expect(onBreak).not.toHaveBeenCalled();
  });

  it('lets Custom become a 1 to 180 minute field and blocks Start when empty', () => {
    const { onChoiceChange, onStart } = renderPrompt('ask', { choice: 'custom' });
    expect(screen.getByTestId('duration-custom').textContent).toBe('Custom');
    expect(screen.getByTestId('custom-minutes')).toBeTruthy();
    expect(screen.queryByTestId('custom-minutes-error')).toBeNull();
    expect(screen.getByTestId('focus-start')).toHaveProperty('disabled', true);
    fireEvent.click(screen.getByTestId('duration-50m'));
    expect(onChoiceChange).toHaveBeenCalledWith(50);
    expect(onStart).not.toHaveBeenCalled();
  });

  it('accepts a typed custom length', () => {
    const { onChoiceChange, onStart } = renderPrompt('ask', { choice: 'custom' });
    const field = screen.getByTestId('custom-minutes');
    fireEvent.change(field, { target: { value: '40' } });
    expect(onChoiceChange).toHaveBeenCalledWith(40);
    fireEvent.change(field, { target: { value: '181' } });
    expect(screen.getByTestId('custom-minutes-error').textContent).toBe(
      'Enter a whole number from 1 to 180.'
    );
    expect(screen.getByTestId('focus-start')).toHaveProperty('disabled', true);
    expect(onStart).not.toHaveBeenCalled();
  });

  it('moves duration chips with arrows and starts on Enter', () => {
    const { onChoiceChange, onStart } = renderPrompt('ask');
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(screen.getByTestId('duration-90m').getAttribute('data-highlighted')).toBe('true');
    expect(onChoiceChange).toHaveBeenCalledWith(90);
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it('selects the clicked duration without starting', () => {
    const { onChoiceChange, onStart } = renderPrompt('ask');
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(screen.getByTestId('duration-90m').getAttribute('data-highlighted')).toBe('true');
    fireEvent.mouseEnter(screen.getByTestId('duration-50m'));
    expect(screen.getByTestId('duration-50m').getAttribute('data-highlighted')).toBe('true');
    expect(onStart).not.toHaveBeenCalled();
    screen.getByTestId('duration-50m').click();
    expect(onChoiceChange).toHaveBeenCalledWith(50);
    expect(onStart).not.toHaveBeenCalled();
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it('starts from the Start button after a duration click', () => {
    const { onStart } = renderPrompt('ask');
    screen.getByTestId('duration-25m').click();
    expect(onStart).not.toHaveBeenCalled();
    screen.getByTestId('focus-start').click();
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it('gives duration chips a pointer cursor and a 44px hit area', () => {
    renderAsk('');
    const chip = screen.getByTestId('duration-50m');
    expect(chip.className).toMatch(/min-h-\[44px\]/);
    expect(chip.className).toMatch(/cursor-pointer/);
    const selected = chip.querySelector('span');
    expect(selected?.className).toMatch(/underline/);
    expect(selected?.className).not.toMatch(/rounded-full|bg-orb-highlight|ring-2/);
    expect(selected?.className).toMatch(/type-whoop/);
  });

  it('confirms a non-highlighted stop-confirm option on click', () => {
    const { onEnd, onKeepGoing } = renderPrompt('stop-confirm');
    expect(screen.getByTestId('keep-going').getAttribute('data-highlighted')).toBe('true');
    screen.getByTestId('end-focus').click();
    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(onKeepGoing).not.toHaveBeenCalled();
  });

  it('fills the input when Enter confirms a highlighted suggestion', () => {
    const { onTaskChange, onStart } = renderAsk('');
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(screen.getByTestId('recent-review pr').getAttribute('data-highlighted')).toBe('true');
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(onTaskChange).toHaveBeenCalledWith('review pr');
    expect(onStart).not.toHaveBeenCalled();
  });

  it('lets empty-input arrows move chips and reach Start', () => {
    const { onStart } = renderAsk('');
    const input = screen.getByTestId('focus-task') as HTMLInputElement;
    input.focus();
    fireEvent.keyDown(input, { key: 'ArrowRight' });
    expect(screen.getByTestId('duration-90m').getAttribute('data-highlighted')).toBe('true');
    fireEvent.keyDown(input, { key: 'ArrowRight' });
    expect(screen.getByTestId('duration-custom').getAttribute('data-highlighted')).toBe('true');
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

  it('shows a muted WHOOP line and offer, and hides the line on Escape', () => {
    const onHideWhoopLine = vi.fn();
    renderPrompt('ask', {
      whoopLine: 'Recovery 28%. Shorter blocks today.',
      whoopOfferMinutes: 25,
      onHideWhoopLine,
    });
    const line = screen.getByTestId('whoop-line');
    expect(line.textContent).toContain('WHOOP');
    expect(line.textContent).toContain('Recovery 28%. Shorter blocks today.');
    expect(line.className).toContain('text-orb-quiet');
    expect(line.className).not.toMatch(/bg-|rounded-full|badge/);
    const link = screen.getByTestId('whoop-link') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('https://app.whoop.com');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    expect(screen.getByTestId('whoop-offer').textContent).toBe('25m today');
    expect(screen.getByTestId('whoop-offer').className).toContain('whoop-offer');
    expect(screen.getByTestId('whoop-offer').className).not.toMatch(/rounded-full|badge/);
    expect(screen.queryByTestId('prompt-context')).toBeNull();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onHideWhoopLine).toHaveBeenCalledTimes(1);
  });

  it('shows a second WHOOP window line without pills or em dashes', () => {
    renderPrompt('ask', {
      whoopLine: 'Recovery 42%, slept 5h 50m (72%), so 25m blocks today.',
      whoopWindow: 'Best focus window 2 to 4 PM.',
      whoopOfferMinutes: 25,
    });
    expect(screen.getByTestId('whoop-window').textContent).toBe('Best focus window 2 to 4 PM.');
    expect(screen.getByTestId('whoop-window').textContent).not.toMatch(/[—–]/);
    expect(screen.getByTestId('whoop-line').className).not.toMatch(/rounded-full|badge/);
  });

  it('picks the WHOOP length from the muted offer by click and keyboard', () => {
    const { onChoiceChange, onStart } = renderPrompt('ask', {
      whoopLine: 'Recovery 28%. Shorter blocks today.',
      whoopOfferMinutes: 25,
      choice: 50,
    });
    expect(screen.getByTestId('whoop-offer').textContent).toBe('25m today');
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(screen.getByTestId('whoop-offer').getAttribute('data-highlighted')).toBe('true');
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(onChoiceChange).toHaveBeenCalledWith(25);
    expect(onStart).not.toHaveBeenCalled();
    screen.getByTestId('whoop-offer').click();
    expect(onChoiceChange).toHaveBeenLastCalledWith(25);
    expect(onStart).not.toHaveBeenCalled();
  });

  it('underlines the WHOOP length in Adapt', () => {
    renderPrompt('ask', {
      whoopLine: 'Recovery 82%. Good day for deep work.',
      whoopOfferMinutes: 50,
      whoopAdapt: true,
      choice: 50,
    });
    expect(screen.getByTestId('duration-50m').getAttribute('data-whoop-adapt')).toBe('true');
    expect(screen.getByTestId('whoop-offer').getAttribute('data-whoop-adapt')).toBe('true');
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
