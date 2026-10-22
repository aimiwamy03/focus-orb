'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  ANOTHER_ROUND_LABEL,
  ASK_PROMPT,
  DONE_LABEL,
  DURATION_CHIPS,
  DurationChoice,
  END_EARLY_PROMPT,
  END_LABEL,
  END_SESSION_LABEL,
  END_SESSION_PROMPT,
  FALLBACK_TASK,
  formatBreakCopy,
  formatCompleted,
  formatFocusingCopy,
  JOIN_LABEL,
  KEEP_GOING_LABEL,
  KEEP_RESTING_LABEL,
  MENU_ASK_HINT,
  PromptSurface,
  SKIP_LABEL,
  START_LABEL,
  UNTIL_MEETING_LABEL,
  suggestionMatchesInput,
  visibleAskSuggestions,
} from '@/lib/focusPrompt';
import { createMenuState, reduceMenu, type MenuState } from '@/lib/menuKey';
import { SPACE_HINT } from '@/lib/shortcuts';
import { ChoiceItem, ChoiceRow, choiceClass } from './ChoiceRow';
import { KeyHint } from './KeyHint';

interface FocusPromptProps {
  surface: PromptSurface;
  contextLine?: string | null;
  task: string;
  onTaskChange: (value: string) => void;
  recentTasks: string[];
  choice: DurationChoice;
  onChoiceChange: (choice: DurationChoice) => void;
  untilMinutes: number | null;
  focusMinutes: number | null;
  completedTask?: string;
  completedMinutes?: number;
  completedPlanned?: number;
  joinUrl?: string | null;
  onStart: (task?: string, choice?: DurationChoice) => void;
  onKeepGoing: () => void;
  onEnd: () => void;
  onBreak: () => void;
  onAnotherRound: () => void;
  onJoin?: () => void;
  onSkip?: () => void;
  onOpenSession?: () => void;
  onKeepSession?: () => void;
  onEndSession?: () => void;
  onOpenLog?: () => void;
  sessionKeepLabel?: string;
  chromeVisible?: boolean;
  keyboardActive?: boolean;
}

type MenuItem = ChoiceItem & {
  action:
    | 'duration'
    | 'start'
    | 'recent'
    | 'keep'
    | 'end-block'
    | 'open-session'
    | 'end-session'
    | 'keep-session'
    | 'break'
    | 'another'
    | 'join'
    | 'skip';
  value?: DurationChoice | string;
};

function durationItems(untilMinutes: number | null): MenuItem[] {
  return [
    ...DURATION_CHIPS.map((minutes) => ({
      id: `duration-${minutes}m`,
      label: `${minutes}m`,
      value: minutes,
      action: 'duration' as const,
      disabled: untilMinutes != null && minutes > untilMinutes,
    })),
    ...(untilMinutes != null
      ? [
          {
            id: 'duration-Until next meeting',
            label: UNTIL_MEETING_LABEL,
            value: 'until' as const,
            action: 'duration' as const,
          },
        ]
      : []),
  ];
}

function itemsFor(
  surface: PromptSurface,
  untilMinutes: number | null,
  joinUrl: string | null | undefined,
  suggestions: string[],
  keepSessionLabel: string
): MenuItem[] {
  if (surface === 'ask') {
    return [
      ...suggestions.map((name) => ({
        id: `recent-${name}`,
        label: name,
        action: 'recent' as const,
        value: name,
      })),
      ...durationItems(untilMinutes),
      { id: 'focus-start', label: START_LABEL, action: 'start' },
    ];
  }
  if (surface === 'stop-confirm') {
    return [
      { id: 'keep-going', label: KEEP_GOING_LABEL, action: 'keep' },
      { id: 'end-focus', label: END_LABEL, action: 'end-block' },
    ];
  }
  if (surface === 'session-confirm') {
    return [
      { id: 'keep-session', label: keepSessionLabel, action: 'keep-session' },
      { id: 'end-session', label: END_SESSION_LABEL, action: 'end-session' },
    ];
  }
  if (surface === 'completed') {
    return [
      { id: 'take-break', label: DONE_LABEL, action: 'break' },
      { id: 'another-round', label: ANOTHER_ROUND_LABEL, action: 'another' },
    ];
  }
  if (surface === 'meeting-soon' && joinUrl) {
    return [
      { id: 'join-meeting', label: JOIN_LABEL, action: 'join' },
      { id: 'skip-meeting', label: SKIP_LABEL, action: 'skip' },
    ];
  }
  if (surface === 'break' || surface === 'focusing') {
    return [{ id: 'end-session', label: END_SESSION_LABEL, action: 'open-session' }];
  }
  return [];
}

function defaultIndex(surface: PromptSurface, items: MenuItem[], choice: DurationChoice): number {
  if (surface === 'ask') {
    const match = items.findIndex((item) => item.action === 'duration' && item.value === choice);
    return match >= 0 ? match : 0;
  }
  if (surface === 'completed') return Math.min(1, Math.max(0, items.length - 1));
  return 0;
}

export function FocusPrompt({
  surface,
  contextLine,
  task,
  onTaskChange,
  recentTasks,
  choice,
  onChoiceChange,
  untilMinutes,
  focusMinutes,
  completedTask,
  completedMinutes,
  completedPlanned,
  joinUrl = null,
  onStart,
  onKeepGoing,
  onEnd,
  onBreak,
  onAnotherRound,
  onJoin,
  onSkip,
  onOpenSession,
  onKeepSession,
  onEndSession,
  onOpenLog,
  sessionKeepLabel = KEEP_RESTING_LABEL,
  chromeVisible = false,
  keyboardActive = true,
}: FocusPromptProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const suggestions = useMemo(() => visibleAskSuggestions(recentTasks, task), [recentTasks, task]);
  const items = useMemo(
    () => itemsFor(surface, untilMinutes, joinUrl, mounted ? suggestions : [], sessionKeepLabel),
    [surface, untilMinutes, joinUrl, mounted, suggestions, sessionKeepLabel]
  );
  const durations = useMemo(() => durationItems(untilMinutes), [untilMinutes]);
  const [menu, setMenu] = useState<MenuState>(() =>
    createMenuState({
      count: items.length,
      index: defaultIndex(surface, items, choice),
      hasInput: surface === 'ask',
      disabled: items.map((item) => Boolean(item.disabled)),
    })
  );

  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef(menu);
  menuRef.current = menu;
  const handlersRef = useRef({
    onStart,
    onKeepGoing,
    onEnd,
    onBreak,
    onAnotherRound,
    onJoin,
    onSkip,
    onChoiceChange,
    onOpenSession,
    onKeepSession,
    onEndSession,
    onTaskChange,
    surface,
    items,
  });
  handlersRef.current = {
    onStart,
    onKeepGoing,
    onEnd,
    onBreak,
    onAnotherRound,
    onJoin,
    onSkip,
    onChoiceChange,
    onOpenSession,
    onKeepSession,
    onEndSession,
    onTaskChange,
    surface,
    items,
  };

  const itemKey = items.map((item) => `${item.id}:${item.disabled ? 1 : 0}`).join('|');
  useEffect(() => {
    setMenu(
      createMenuState({
        count: items.length,
        index: defaultIndex(surface, items, choice),
        hasInput: surface === 'ask',
        disabled: items.map((item) => Boolean(item.disabled)),
      })
    );
    // Reset when the row itself changes, not on every duration highlight.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [surface, itemKey]);

  useEffect(() => {
    if (surface === 'ask') inputRef.current?.focus({ preventScroll: true });
  }, [surface]);

  const confirmIndex = (index: number) => {
    const item = handlersRef.current.items[index];
    if (!item || item.disabled) return;
    const { surface: kind } = handlersRef.current;
    if (item.action === 'duration') {
      const duration = item.value as DurationChoice;
      handlersRef.current.onChoiceChange(duration);
      handlersRef.current.onStart(undefined, duration);
      return;
    }
    if (item.action === 'start') {
      handlersRef.current.onStart();
      return;
    }
    if (item.action === 'recent') {
      handlersRef.current.onTaskChange(String(item.value ?? item.label));
      inputRef.current?.focus();
      setMenu((current) => ({ ...current, focus: 'input' }));
      return;
    }
    if (item.action === 'keep') {
      handlersRef.current.onKeepGoing();
      return;
    }
    if (item.action === 'end-block') {
      handlersRef.current.onEnd();
      return;
    }
    if (item.action === 'open-session') {
      handlersRef.current.onOpenSession?.();
      return;
    }
    if (item.action === 'keep-session') {
      handlersRef.current.onKeepSession?.();
      return;
    }
    if (item.action === 'end-session') {
      handlersRef.current.onEndSession?.();
      return;
    }
    if (item.action === 'break') {
      handlersRef.current.onBreak();
      return;
    }
    if (item.action === 'another') {
      handlersRef.current.onAnotherRound();
      return;
    }
    if (kind === 'meeting-soon') {
      if (item.action === 'skip') handlersRef.current.onSkip?.();
      else handlersRef.current.onJoin?.();
    }
  };

  const cancelMenu = () => {
    const { surface: kind } = handlersRef.current;
    if (kind === 'ask') {
      inputRef.current?.blur();
      return;
    }
    if (kind === 'stop-confirm') handlersRef.current.onKeepGoing();
    if (kind === 'meeting-soon') handlersRef.current.onSkip?.();
    if (kind === 'break' || kind === 'focusing') handlersRef.current.onOpenSession?.();
    if (kind === 'session-confirm') handlersRef.current.onKeepSession?.();
  };

  const highlightIndex = (index: number) => {
    setMenu((current) => ({ ...current, index, focus: 'row' }));
    const item = handlersRef.current.items[index];
    if (item?.action === 'duration' && !item.disabled) {
      handlersRef.current.onChoiceChange(item.value as DurationChoice);
    }
  };

  useEffect(() => {
    if (!keyboardActive || items.length === 0) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target;
      const inField =
        target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
      const ourInput =
        inField && target instanceof HTMLElement && Boolean(target.closest('[data-testid="focus-prompt"]'));
      const inputEmpty = ourInput && target instanceof HTMLInputElement ? target.value.length === 0 : false;
      const result = reduceMenu(menuRef.current, {
        key: event.key,
        shiftKey: event.shiftKey,
        inInput: Boolean(ourInput),
        inputEmpty,
      });
      if (result.preventDefault) event.preventDefault();
      menuRef.current = result.state;
      setMenu(result.state);
      if (
        handlersRef.current.surface === 'ask' &&
        result.state.focus === 'row' &&
        (event.key === 'ArrowLeft' ||
          event.key === 'ArrowRight' ||
          event.key === 'ArrowUp' ||
          event.key === 'ArrowDown' ||
          event.key === 'Tab')
      ) {
        const item = handlersRef.current.items[result.state.index];
        if (item?.action === 'duration' && !item.disabled) {
          handlersRef.current.onChoiceChange(item.value as DurationChoice);
        }
      }
      if (result.effect === 'confirm') confirmIndex(result.state.index);
      if (result.effect === 'cancel') cancelMenu();
      if (result.effect === 'focus-row') inputRef.current?.blur();
      if (result.effect === 'focus-input') inputRef.current?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [keyboardActive, items.length]);

  if (surface === 'in-meeting') return null;

  const focusing = formatFocusingCopy(task, focusMinutes ?? 0);
  const durationOffset = items.findIndex((item) => item.action === 'duration');
  const startIndex = items.findIndex((item) => item.action === 'start');
  const durationHighlight =
    durationOffset >= 0 && items[menu.index]?.action === 'duration'
      ? menu.index - durationOffset
      : -1;

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    onStart();
  };

  const endSessionItems = items.filter((item) => item.action === 'open-session');

  return (
    <div
      data-testid="focus-prompt"
      data-surface={surface}
      className="relative z-20 flex w-[min(32rem,92vw)] shrink-0 cursor-auto flex-col items-center gap-[length:var(--stack-gap)] text-center"
    >
      {surface === 'ask' && contextLine ? (
        <div
          data-testid="prompt-context"
          data-text-clear
          className="text-[length:var(--type-status)] leading-snug"
          style={{ color: '#8a8a90' }}
        >
          {contextLine}
        </div>
      ) : null}

      {surface === 'ask' ? (
        <form onSubmit={onSubmit} className="flex w-full flex-col items-center gap-[length:var(--stack-gap)]">
          <label
            data-text-clear
            className="text-[length:var(--type-heading)] leading-tight tracking-wide text-orb-text"
          >
            {ASK_PROMPT}
          </label>
          <div className="ask-task-wrap">
            <div className="ask-task-field">
              <span className="ask-task-sizer" aria-hidden>
                {task || FALLBACK_TASK}
              </span>
              {task ? null : (
                <span
                  data-testid="focus-task-placeholder"
                  className="ask-task-placeholder"
                  aria-hidden
                >
                  {FALLBACK_TASK}
                </span>
              )}
              <input
                ref={inputRef}
                data-testid="focus-task"
                value={task}
                autoFocus
                onChange={(event) => onTaskChange(event.target.value)}
                onFocus={() => setMenu((current) => ({ ...current, focus: 'input' }))}
                onBlur={() => setMenu((current) => ({ ...current, focus: 'row' }))}
                placeholder={FALLBACK_TASK}
                autoComplete="off"
                className="ask-task"
              />
            </div>
          </div>
          {mounted && suggestions.length > 0 ? (
            <div data-testid="recent-tasks" className="ask-suggestions">
              {suggestions.map((item, index) => {
                const keyboardOnRecent =
                  menu.focus === 'row' && items[menu.index]?.action === 'recent';
                const active = keyboardOnRecent
                  ? menu.index === index
                  : suggestionMatchesInput(item, task);
                return (
                  <button
                    key={item}
                    type="button"
                    tabIndex={-1}
                    title={item}
                    data-testid={`recent-${item}`}
                    data-highlighted={active ? 'true' : 'false'}
                    onMouseDown={(event) => event.preventDefault()}
                    onMouseEnter={() => highlightIndex(index)}
                    onClick={() => onTaskChange(item)}
                    className="ask-suggestion"
                  >
                    <span className="ask-suggestion-label">{item}</span>
                  </button>
                );
              })}
            </div>
          ) : null}
          <ChoiceRow
            testId="duration-chips"
            tone="chip"
            items={durations}
            highlighted={durationHighlight}
            onHighlight={(index) => highlightIndex(durationOffset + index)}
            onConfirm={(index) => confirmIndex(durationOffset + index)}
          />
          <div
            data-testid="menu-hint"
            data-text-clear
            aria-label={MENU_ASK_HINT}
            className={`flex items-center justify-center gap-1.5 text-[length:var(--type-hint)] tracking-wide text-orb-quiet transition-opacity duration-300 ${
              chromeVisible ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <KeyHint label="←" />
            <KeyHint label="→" />
            <span>to choose,</span>
            <KeyHint label="Enter" />
            <span>to start</span>
          </div>
          <button
            type="submit"
            tabIndex={-1}
            data-testid="focus-start"
            data-highlighted={menu.index === startIndex ? 'true' : 'false'}
            onMouseDown={(event) => event.preventDefault()}
            onMouseEnter={() => highlightIndex(startIndex)}
            className="inline-flex min-h-[44px] cursor-pointer items-center justify-center bg-transparent"
          >
            <span
              className={
                menu.index === startIndex
                  ? choiceClass('button', true, false)
                  : 'rounded-full border border-white/20 bg-white/15 px-[length:var(--btn-px)] py-[length:var(--btn-py)] text-[length:var(--type-button)] font-medium tracking-wide text-orb-text hover:bg-white/25 outline-none focus:outline-none'
              }
            >
              {START_LABEL}
            </span>
          </button>
        </form>
      ) : null}

      {surface === 'focusing' ? (
        <div className="space-y-3">
          <div className="space-y-1">
            <div
              data-text-clear
              data-testid="focus-task-name"
              className="text-[length:var(--type-heading)] leading-tight text-orb-text"
            >
              {focusing.task}
            </div>
            <div
              data-text-clear
              data-testid="focus-countdown"
              className="text-[length:var(--type-status)] text-orb-text"
            >
              {focusing.countdown}
            </div>
            <div
              data-testid="space-hint"
              data-text-clear
              className={`text-[length:var(--type-hint)] tracking-wide text-orb-quiet transition-opacity duration-300 ${
                chromeVisible ? 'opacity-100' : 'opacity-0'
              }`}
            >
              {SPACE_HINT}
            </div>
          </div>
          {endSessionItems.length > 0 ? (
            <ChoiceRow
              testId="end-session-row"
              tone="quiet"
              items={endSessionItems}
              highlighted={menu.index}
              onHighlight={highlightIndex}
              onConfirm={confirmIndex}
            />
          ) : null}
        </div>
      ) : null}

      {surface === 'stop-confirm' ? (
        <div className="space-y-3">
          <div data-text-clear className="text-[length:var(--type-heading)] leading-tight text-orb-text">
            {END_EARLY_PROMPT}
          </div>
          <ChoiceRow
            testId="stop-confirm-row"
            items={items}
            highlighted={menu.index}
            onHighlight={highlightIndex}
            onConfirm={confirmIndex}
          />
        </div>
      ) : null}

      {surface === 'session-confirm' ? (
        <div className="space-y-3">
          <div
            data-text-clear
            data-testid="end-session-prompt"
            className="text-[length:var(--type-heading)] leading-tight text-orb-text"
          >
            {END_SESSION_PROMPT}
          </div>
          <ChoiceRow
            testId="session-confirm-row"
            items={items}
            highlighted={menu.index}
            onHighlight={highlightIndex}
            onConfirm={confirmIndex}
          />
        </div>
      ) : null}

      {surface === 'completed' && completedTask != null && completedMinutes != null ? (
        <div className="space-y-3">
          <button
            type="button"
            data-text-clear
            data-testid="focus-completed"
            onClick={() => onOpenLog?.()}
            className="text-[length:var(--type-heading)] leading-tight text-orb-text underline-offset-4 hover:underline"
          >
            {formatCompleted(completedMinutes, completedTask, completedPlanned)}
          </button>
          <ChoiceRow
            testId="completed-row"
            items={items}
            highlighted={menu.index}
            onHighlight={highlightIndex}
            onConfirm={confirmIndex}
          />
        </div>
      ) : null}

      {surface === 'meeting-soon' ? (
        <div className="space-y-3">
          <div
            data-text-clear
            data-testid="meeting-soon-prompt"
            className="text-[length:var(--type-heading)] leading-tight text-orb-text"
          >
            {contextLine}
          </div>
          {items.length > 0 ? (
            <ChoiceRow
              testId="meeting-row"
              items={items}
              highlighted={menu.index}
              onHighlight={highlightIndex}
              onConfirm={confirmIndex}
            />
          ) : null}
        </div>
      ) : null}

      {surface === 'break' ? (
        <div className="space-y-3">
          <div
            data-text-clear
            data-testid="focus-break"
            className="text-[length:var(--type-heading)] leading-tight text-orb-text"
          >
            {formatBreakCopy(focusMinutes ?? 0)}
          </div>
          {endSessionItems.length > 0 ? (
            <ChoiceRow
              testId="end-session-row"
              tone="quiet"
              items={endSessionItems}
              highlighted={menu.index}
              onHighlight={highlightIndex}
              onConfirm={confirmIndex}
            />
          ) : null}
        </div>
      ) : null}

    </div>
  );
}
