'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  ANOTHER_ROUND_LABEL,
  ASK_PROMPT,
  CUSTOM_DURATION_LABEL,
  DURATION_CHIPS,
  DurationChoice,
  TAKE_BREAK_LABEL,
  canStartCustom,
  customDurationError,
  isCustomDuration,
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
import {
  NEXT_STEP_LABEL,
  NEXT_STEP_PLACEHOLDER,
  RATING_PROMPT,
} from '@/lib/orbGrowth';
import { WHOOP_APP_URL, whoopOfferLabel } from '@/lib/whoop';
import { ChoiceItem, ChoiceRow, choiceClass } from './ChoiceRow';
import { KeyHint } from './KeyHint';

interface FocusPromptProps {
  surface: PromptSurface;
  contextLine?: string | null;
  whoopLine?: string | null;
  whoopWindow?: string | null;
  whoopOfferMinutes?: number | null;
  whoopAdapt?: boolean;
  onHideWhoopLine?: () => void;
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
  focusedToday?: string | null;
  returnLine?: string | null;
  yesterdayTask?: string | null;
  yesterdayNote?: string | null;
  blooming?: boolean;
  nextStep?: string;
  onNextStepChange?: (value: string) => void;
  focusRating?: number | null;
  onFocusRating?: (value: number) => void;
}

type MenuItem = ChoiceItem & {
  action:
    | 'duration'
    | 'whoop'
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
    {
      id: 'duration-custom',
      label: CUSTOM_DURATION_LABEL,
      value: 'custom' as const,
      action: 'duration' as const,
    },
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
  keepSessionLabel: string,
  whoopOfferMinutes: number | null
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
      ...(whoopOfferMinutes != null
        ? [
            {
              id: 'whoop-offer',
              label: whoopOfferLabel(whoopOfferMinutes),
              action: 'whoop' as const,
              value: whoopOfferMinutes,
            },
          ]
        : []),
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
      { id: 'take-break', label: TAKE_BREAK_LABEL, action: 'break' },
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

function NextStepNote({
  value,
  onChange,
}: {
  value: string;
  onChange?: (value: string) => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const field = ref.current;
    if (!field) return;
    field.style.height = 'auto';
    field.style.height = `${field.scrollHeight}px`;
  }, [value]);

  return (
    <textarea
      ref={ref}
      data-testid="next-step"
      data-text-clear
      value={value}
      rows={1}
      onChange={(event) => onChange?.(event.target.value)}
      placeholder={NEXT_STEP_PLACEHOLDER}
      className="next-step"
    />
  );
}

function defaultIndex(surface: PromptSurface, items: MenuItem[], choice: DurationChoice): number {
  if (surface === 'ask') {
    if (isCustomDuration(choice)) {
      const custom = items.findIndex((item) => item.value === 'custom');
      return custom >= 0 ? custom : 0;
    }
    const match = items.findIndex((item) => item.action === 'duration' && item.value === choice);
    return match >= 0 ? match : 0;
  }
  if (surface === 'completed') return Math.min(1, Math.max(0, items.length - 1));
  return 0;
}

export function FocusPrompt({
  surface,
  contextLine,
  whoopLine = null,
  whoopWindow = null,
  whoopOfferMinutes = null,
  whoopAdapt = false,
  onHideWhoopLine,
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
  focusedToday = null,
  returnLine = null,
  yesterdayTask = null,
  yesterdayNote = null,
  blooming = false,
  nextStep = '',
  onNextStepChange,
  focusRating = null,
  onFocusRating,
}: FocusPromptProps) {
  const [mounted, setMounted] = useState(false);
  const [menuArmed, setMenuArmed] = useState(false);
  const [customDraft, setCustomDraft] = useState(
    isCustomDuration(choice) && typeof choice === 'number' ? String(choice) : ''
  );
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (isCustomDuration(choice) && typeof choice === 'number') {
      setCustomDraft(String(choice));
    }
  }, [choice]);

  const suggestions = useMemo(() => {
    if (!task.trim() && (yesterdayTask || yesterdayNote)) return [];
    return visibleAskSuggestions(recentTasks, task);
  }, [recentTasks, task, yesterdayNote, yesterdayTask]);
  const items = useMemo(
    () =>
      itemsFor(
        surface,
        untilMinutes,
        joinUrl,
        mounted ? suggestions : [],
        sessionKeepLabel,
        surface === 'ask' ? whoopOfferMinutes : null
      ),
    [surface, untilMinutes, joinUrl, mounted, suggestions, sessionKeepLabel, whoopOfferMinutes]
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
    choice,
    customDraft,
    untilMinutes,
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
    choice,
    customDraft,
    untilMinutes,
  };

  const itemKey = items.map((item) => `${item.id}:${item.disabled ? 1 : 0}`).join('|');
  useEffect(() => {
    setMenuArmed(false);
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
      if (duration === 'custom') {
        const parsed = canStartCustom(
          handlersRef.current.customDraft,
          handlersRef.current.untilMinutes
        );
        if (!parsed.ok) {
          handlersRef.current.onChoiceChange('custom');
          return;
        }
        handlersRef.current.onChoiceChange(parsed.minutes);
        handlersRef.current.onStart(undefined, parsed.minutes);
        return;
      }
      handlersRef.current.onChoiceChange(duration);
      handlersRef.current.onStart(undefined, duration);
      return;
    }
    if (item.action === 'whoop') {
      handlersRef.current.onChoiceChange(item.value as DurationChoice);
      return;
    }
    if (item.action === 'start') {
      const current = handlersRef.current;
      if (isCustomDuration(current.choice)) {
        const parsed = canStartCustom(current.customDraft, current.untilMinutes);
        if (!parsed.ok) return;
        current.onStart(undefined, parsed.minutes);
        return;
      }
      current.onStart();
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
      onHideWhoopLine?.();
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
    if ((item?.action === 'duration' || item?.action === 'whoop') && !item.disabled) {
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
        setMenuArmed(true);
        const item = handlersRef.current.items[result.state.index];
        if (
          (item?.action === 'duration' || item?.action === 'whoop') &&
          !item.disabled &&
          item.value !== 'custom'
        ) {
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
  const whoopIndex = items.findIndex((item) => item.action === 'whoop');
  const startIndex = items.findIndex((item) => item.action === 'start');
  const durationHighlight =
    durationOffset >= 0 && items[menu.index]?.action === 'duration'
      ? menu.index - durationOffset
      : -1;

  const customSelected = isCustomDuration(choice);
  const customError = customSelected ? customDurationError(customDraft, untilMinutes) : null;
  const customReady = customSelected ? canStartCustom(customDraft, untilMinutes) : null;
  const startBlocked = Boolean(customSelected && !customReady?.ok);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (startBlocked) return;
    if (customReady?.ok) {
      onStart(undefined, customReady.minutes);
      return;
    }
    onStart();
  };

  const endSessionItems = items.filter((item) => item.action === 'open-session');

  return (
    <div
      data-testid="focus-prompt"
      data-surface={surface}
      data-menu-armed={menuArmed ? 'true' : 'false'}
      className="relative z-20 flex w-[min(32rem,92vw)] shrink-0 cursor-auto flex-col items-center gap-[length:var(--stack-gap)] text-center"
    >
      {surface === 'ask' && whoopLine ? (
        <div
          data-testid="whoop-line"
          data-text-clear
          className="flex max-w-[min(32rem,92vw)] flex-col items-center gap-1 text-[length:var(--type-whoop)] leading-snug text-orb-quiet"
        >
          <p className="m-0">
            <a
              data-testid="whoop-link"
              href={WHOOP_APP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-orb-text underline decoration-1 underline-offset-[3px]"
            >
              WHOOP
            </a>
            {` ${whoopLine}`}
          </p>
          {whoopWindow ? (
            <p data-testid="whoop-window" className="m-0">
              {whoopWindow}
            </p>
          ) : null}
        </div>
      ) : surface === 'ask' && contextLine ? (
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
            data-testid="ask-heading"
            data-text-clear
            className="text-[length:var(--type-heading)] leading-tight tracking-wide text-orb-text"
          >
            {ASK_PROMPT}
          </label>
          <div className="ask-task-wrap">
            <div
              className="ask-task-field"
              data-testid="ask-task-field"
              data-value={task || FALLBACK_TASK}
            >
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
                size={1}
                autoFocus
                onChange={(event) => onTaskChange(event.target.value)}
                onFocus={() => {
                  setMenuArmed(false);
                  setMenu((current) => ({ ...current, focus: 'input' }));
                }}
                onBlur={() => setMenu((current) => ({ ...current, focus: 'row' }))}
                placeholder={FALLBACK_TASK}
                autoComplete="off"
                className="ask-task"
              />
            </div>
          </div>
          {!task.trim() && (yesterdayTask || yesterdayNote) ? (
            <div data-testid="ask-yesterday" className="ask-yesterday">
              {yesterdayTask ? (
                <button
                  type="button"
                  data-testid="ask-yesterday-task"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => onTaskChange(yesterdayTask)}
                  className="ask-yesterday-chip"
                >
                  {yesterdayTask}
                </button>
              ) : null}
              {yesterdayNote ? (
                <button
                  type="button"
                  data-testid="ask-yesterday-note"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => onTaskChange(yesterdayNote)}
                  className="ask-yesterday-chip"
                >
                  {yesterdayNote}
                </button>
              ) : null}
            </div>
          ) : null}
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
            underlined={
              customSelected
                ? durations.findIndex((item) => item.value === 'custom')
                : whoopAdapt && typeof choice === 'number'
                  ? durations.findIndex((item) => item.value === choice)
                  : -1
            }
            onHighlight={(index) => highlightIndex(durationOffset + index)}
            onConfirm={(index) => confirmIndex(durationOffset + index)}
            confirmOnClick={false}
          />
          {customSelected ? (
            <div className="flex flex-col items-center gap-2">
              <input
                data-testid="custom-minutes"
                className="custom-minutes"
                inputMode="numeric"
                pattern="[0-9]*"
                value={customDraft}
                aria-label="Custom minutes"
                onChange={(event) => {
                  const next = event.target.value.replace(/\D/g, '');
                  setCustomDraft(next);
                  const parsed = canStartCustom(next, untilMinutes);
                  if (parsed.ok) onChoiceChange(parsed.minutes);
                  else onChoiceChange('custom');
                }}
              />
              {customError ? (
                <p data-testid="custom-minutes-error" className="custom-minutes-error">
                  {customError}
                </p>
              ) : null}
            </div>
          ) : null}
          {whoopIndex >= 0 && whoopOfferMinutes != null ? (
            <button
              type="button"
              tabIndex={-1}
              data-testid="whoop-offer"
              data-highlighted={menu.index === whoopIndex ? 'true' : 'false'}
              data-whoop-adapt={
                whoopAdapt && choice === whoopOfferMinutes ? 'true' : 'false'
              }
              data-text-clear
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => highlightIndex(whoopIndex)}
              onClick={() => {
                highlightIndex(whoopIndex);
                confirmIndex(whoopIndex);
              }}
              className={`whoop-offer cursor-pointer border-0 bg-transparent p-0 text-[length:var(--type-whoop)] leading-snug text-orb-quiet ${
                menu.index === whoopIndex ||
                (whoopAdapt && choice === whoopOfferMinutes)
                  ? 'underline decoration-1 underline-offset-[6px]'
                  : ''
              }`}
            >
              {whoopOfferLabel(whoopOfferMinutes)}
            </button>
          ) : null}
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
            type="button"
            tabIndex={-1}
            data-testid="focus-start"
            data-highlighted={menu.index === startIndex ? 'true' : 'false'}
            disabled={startBlocked}
            onMouseDown={(event) => event.preventDefault()}
            onMouseEnter={() => highlightIndex(startIndex)}
            onClick={() => {
              if (startBlocked) return;
              if (customReady?.ok) onStart(undefined, customReady.minutes);
              else onStart();
            }}
            className="inline-flex min-h-[44px] cursor-pointer items-center justify-center bg-transparent disabled:cursor-default"
          >
            <span className={choiceClass('chip', menu.index === startIndex, startBlocked)}>
              {START_LABEL}
            </span>
          </button>
          {returnLine ? (
            <p
              data-testid="return-line"
              data-text-clear
              className="m-0 text-[length:var(--type-whoop)] leading-snug text-orb-quiet"
            >
              {returnLine}
            </p>
          ) : null}
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
              tone="chip"
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
              tone="chip"
              items={items}
            highlighted={menu.index}
            onHighlight={highlightIndex}
            onConfirm={confirmIndex}
          />
        </div>
      ) : null}

      {surface === 'completed' && completedTask != null && completedMinutes != null ? (
        <div className="flex w-full flex-col items-center gap-[length:var(--stack-gap)]">
          {focusedToday ? (
            <p
              data-testid="focused-today"
              data-text-clear
              className="m-0 text-[length:var(--type-heading)] leading-tight text-orb-text"
            >
              {focusedToday}
            </p>
          ) : null}
          {blooming ? null : (
            <>
              <button
                type="button"
                data-text-clear
                data-testid="focus-completed"
                onClick={() => onOpenLog?.()}
                className="text-[length:var(--type-whoop)] leading-snug text-orb-text underline-offset-4 hover:underline"
              >
                {formatCompleted(completedMinutes, completedTask, completedPlanned)}
              </button>
              <label className="flex w-full max-w-[min(32rem,92vw)] flex-col items-center gap-1">
                <span
                  data-testid="next-step-label"
                  className="text-[length:var(--type-whoop)] leading-snug text-orb-text"
                >
                  {NEXT_STEP_LABEL}
                </span>
                <NextStepNote value={nextStep} onChange={onNextStepChange} />
              </label>
              <div className="flex flex-col items-center gap-2">
                <p
                  data-testid="rating-prompt"
                  className="m-0 text-[length:var(--type-whoop)] leading-snug text-orb-text"
                >
                  {RATING_PROMPT}
                </p>
                <div className="flex items-center gap-4" data-testid="rating-row">
                  {[1, 2, 3, 4, 5].map((value) => (
                    <button
                      key={value}
                      type="button"
                      data-testid={`rating-${value}`}
                      data-selected={focusRating === value ? 'true' : 'false'}
                      onClick={() => onFocusRating?.(value)}
                      className={`min-h-[44px] min-w-[44px] bg-transparent text-[length:var(--type-whoop)] leading-snug ${
                        focusRating === value
                          ? 'text-orb-text underline decoration-1 underline-offset-[6px]'
                          : 'text-orb-quiet hover:text-orb-text'
                      }`}
                    >
                      {value}
                    </button>
                  ))}
                </div>
              </div>
              <ChoiceRow
                testId="completed-row"
                tone="chip"
                items={items}
                highlighted={menu.index}
                onHighlight={highlightIndex}
                onConfirm={confirmIndex}
              />
            </>
          )}
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
              tone="chip"
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
