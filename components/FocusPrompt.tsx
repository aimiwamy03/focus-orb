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
  FALLBACK_TASK,
  formatBreakCopy,
  formatCompleted,
  formatFocusingCopy,
  JOIN_LABEL,
  KEEP_GOING_LABEL,
  MENU_ASK_HINT,
  PromptSurface,
  SKIP_LABEL,
  START_LABEL,
  UNTIL_MEETING_LABEL,
  visibleAskSuggestions,
} from '@/lib/focusPrompt';
import { createMenuState, reduceMenu, type MenuState } from '@/lib/menuKey';
import { SPACE_HINT } from '@/lib/shortcuts';
import { ChoiceItem, ChoiceRow } from './ChoiceRow';
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
  onStart: () => void;
  onKeepGoing: () => void;
  onEnd: () => void;
  onBreak: () => void;
  onAnotherRound: () => void;
  onJoin?: () => void;
  onSkip?: () => void;
  chromeVisible?: boolean;
  keyboardActive?: boolean;
}

function askItems(untilMinutes: number | null): (ChoiceItem & { value: DurationChoice })[] {
  return [
    ...DURATION_CHIPS.map((minutes) => ({
      id: `duration-${minutes}m`,
      label: `${minutes}m`,
      value: minutes,
      disabled: untilMinutes != null && minutes > untilMinutes,
    })),
    ...(untilMinutes != null
      ? [
          {
            id: 'duration-Until next meeting',
            label: UNTIL_MEETING_LABEL,
            value: 'until' as const,
          },
        ]
      : []),
  ];
}

function itemsFor(
  surface: PromptSurface,
  untilMinutes: number | null,
  joinUrl?: string | null
): ChoiceItem[] {
  if (surface === 'ask') return askItems(untilMinutes);
  if (surface === 'stop-confirm') {
    return [
      { id: 'keep-going', label: KEEP_GOING_LABEL },
      { id: 'end-focus', label: END_LABEL },
    ];
  }
  if (surface === 'completed') {
    return [
      { id: 'take-break', label: DONE_LABEL },
      { id: 'another-round', label: ANOTHER_ROUND_LABEL },
    ];
  }
  if (surface === 'meeting-soon' && joinUrl) {
    return [
      { id: 'join-meeting', label: JOIN_LABEL },
      { id: 'skip-meeting', label: SKIP_LABEL },
    ];
  }
  return [];
}

function defaultIndex(surface: PromptSurface, items: ChoiceItem[], choice: DurationChoice): number {
  if (surface === 'ask') {
    const match = items.findIndex((item) => {
      const value = 'value' in item ? (item as { value: DurationChoice }).value : null;
      return value === choice;
    });
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
  chromeVisible = false,
  keyboardActive = true,
}: FocusPromptProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const items = useMemo(
    () => itemsFor(surface, untilMinutes, joinUrl),
    [surface, untilMinutes, joinUrl]
  );
  const durations = useMemo(() => askItems(untilMinutes), [untilMinutes]);
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
    surface,
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
    surface,
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

  const confirmIndex = (index: number) => {
    const { surface: kind } = handlersRef.current;
    if (kind === 'ask') {
      const item = durations[index];
      if (item && !item.disabled) handlersRef.current.onChoiceChange(item.value);
      handlersRef.current.onStart();
      return;
    }
    if (kind === 'stop-confirm') {
      if (index === 1) handlersRef.current.onEnd();
      else handlersRef.current.onKeepGoing();
      return;
    }
    if (kind === 'completed') {
      if (index === 0) handlersRef.current.onBreak();
      else handlersRef.current.onAnotherRound();
      return;
    }
    if (kind === 'meeting-soon') {
      if (index === 1) handlersRef.current.onSkip?.();
      else handlersRef.current.onJoin?.();
    }
  };

  const cancelMenu = () => {
    const { surface: kind } = handlersRef.current;
    if (kind === 'stop-confirm') handlersRef.current.onKeepGoing();
    if (kind === 'meeting-soon') handlersRef.current.onSkip?.();
  };

  const highlightIndex = (index: number) => {
    setMenu((current) => ({ ...current, index, focus: 'row' }));
    if (handlersRef.current.surface === 'ask') {
      const item = durations[index];
      if (item && !item.disabled) handlersRef.current.onChoiceChange(item.value);
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
      const result = reduceMenu(menuRef.current, {
        key: event.key,
        shiftKey: event.shiftKey,
        inInput: Boolean(ourInput),
      });
      if (result.preventDefault) event.preventDefault();
      menuRef.current = result.state;
      setMenu(result.state);
      if (
        handlersRef.current.surface === 'ask' &&
        result.state.focus === 'row' &&
        (event.key === 'ArrowLeft' || event.key === 'ArrowRight' || event.key === 'Tab')
      ) {
        const item = durations[result.state.index];
        if (item && !item.disabled) handlersRef.current.onChoiceChange(item.value);
      }
      if (result.effect === 'confirm') confirmIndex(result.state.index);
      if (result.effect === 'cancel') cancelMenu();
      if (result.effect === 'focus-row') inputRef.current?.blur();
      if (result.effect === 'focus-input') inputRef.current?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [keyboardActive, items.length, durations]);

  if (surface === 'in-meeting') return null;

  const focusing = formatFocusingCopy(task, focusMinutes ?? 0);
  const suggestions = visibleAskSuggestions(recentTasks, task);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    onStart();
  };

  return (
    <div
      data-testid="focus-prompt"
      data-surface={surface}
      className="relative z-20 flex w-[min(32rem,92vw)] shrink-0 flex-col items-center gap-[length:var(--stack-gap)] text-center"
    >
      {surface === 'ask' && contextLine ? (
        <div
          data-testid="prompt-context"
          data-text-clear
          className="text-[length:var(--type-status)] leading-snug text-orb-quiet"
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
          <input
            ref={inputRef}
            data-testid="focus-task"
            value={task}
            onChange={(event) => onTaskChange(event.target.value)}
            onFocus={() => setMenu((current) => ({ ...current, focus: 'input' }))}
            onBlur={() => setMenu((current) => ({ ...current, focus: 'row' }))}
            placeholder={FALLBACK_TASK}
            autoComplete="off"
            className="w-full bg-transparent text-center text-[length:var(--type-input)] text-orb-text outline-none placeholder:text-orb-placeholder"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.18)', paddingBottom: 8 }}
          />
          {mounted && suggestions.length > 0 ? (
            <div data-testid="recent-tasks" className="flex flex-wrap justify-center gap-2">
              {suggestions.map((item) => (
                <button
                  key={item}
                  type="button"
                  tabIndex={-1}
                  data-testid={`recent-${item}`}
                  onClick={() => onTaskChange(item)}
                  className="rounded-full px-3 py-1 text-[length:var(--type-chip)] text-orb-dim hover:text-orb-text"
                >
                  {item}
                </button>
              ))}
            </div>
          ) : null}
          <ChoiceRow
            testId="duration-chips"
            tone="chip"
            confirmOnClick={false}
            items={durations}
            highlighted={menu.index}
            onHighlight={highlightIndex}
            onConfirm={confirmIndex}
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
            className="rounded-full border border-white/20 bg-white/15 px-[length:var(--btn-px)] py-[length:var(--btn-py)] text-[length:var(--type-button)] font-medium tracking-wide text-orb-text hover:bg-white/25 outline-none focus:outline-none"
          >
            {START_LABEL}
          </button>
        </form>
      ) : null}

      {surface === 'focusing' ? (
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
            className="text-[length:var(--type-status)] text-orb-dim"
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

      {surface === 'completed' && completedTask != null && completedMinutes != null ? (
        <div className="space-y-3">
          <div
            data-text-clear
            data-testid="focus-completed"
            className="text-[length:var(--type-heading)] leading-tight text-orb-text"
          >
            {formatCompleted(completedMinutes, completedTask, completedPlanned)}
          </div>
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
        <div
          data-text-clear
          data-testid="focus-break"
          className="text-[length:var(--type-heading)] leading-tight text-orb-dim"
        >
          {formatBreakCopy(focusMinutes ?? 0)}
        </div>
      ) : null}

    </div>
  );
}
