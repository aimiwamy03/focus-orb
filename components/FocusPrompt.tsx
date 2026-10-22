'use client';

import { FormEvent, useEffect, useState } from 'react';
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
  KEEP_GOING_LABEL,
  PromptSurface,
  START_LABEL,
  UNTIL_MEETING_LABEL,
} from '@/lib/focusPrompt';
import { ENTER_HINT, SPACE_HINT } from '@/lib/shortcuts';

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
  onStart: () => void;
  onKeepGoing: () => void;
  onEnd: () => void;
  onBreak: () => void;
  onAnotherRound: () => void;
  onDone: () => void;
  chromeVisible?: boolean;
  completedPlanned?: number;
}

function Chip({
  label,
  selected,
  disabled,
  onClick,
}: {
  label: string;
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      data-testid={`duration-${label}`}
      disabled={disabled}
      onClick={onClick}
      className={`rounded-full px-3.5 py-1.5 text-[length:var(--type-chip)] tracking-wide transition-colors ${
        disabled
          ? 'text-orb-placeholder'
          : selected
            ? 'bg-white/10 text-orb-text'
            : 'text-orb-dim hover:text-orb-text'
      }`}
      aria-pressed={selected}
    >
      {label}
    </button>
  );
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
  onStart,
  onKeepGoing,
  onEnd,
  onBreak,
  onAnotherRound,
  onDone,
  chromeVisible = false,
  completedPlanned,
}: FocusPromptProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (surface === 'in-meeting' || surface === 'meeting-soon') return null;

  const focusing = formatFocusingCopy(task, focusMinutes ?? 0);

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
            data-testid="focus-task"
            value={task}
            onChange={(event) => onTaskChange(event.target.value)}
            placeholder={FALLBACK_TASK}
            autoComplete="off"
            className="w-full bg-transparent text-center text-[length:var(--type-input)] text-orb-text outline-none placeholder:text-orb-placeholder"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.18)', paddingBottom: 8 }}
          />
          {mounted && recentTasks.length > 0 ? (
            <div className="flex flex-wrap justify-center gap-2">
              {recentTasks.map((item) => (
                <button
                  key={item}
                  type="button"
                  data-testid={`recent-${item}`}
                  onClick={() => onTaskChange(item)}
                  className="rounded-full px-3 py-1 text-[length:var(--type-chip)] text-orb-dim hover:text-orb-text"
                >
                  {item}
                </button>
              ))}
            </div>
          ) : null}
          <div data-testid="duration-chips" className="flex flex-wrap justify-center gap-1">
            {DURATION_CHIPS.map((minutes) => (
              <Chip
                key={minutes}
                label={`${minutes}m`}
                selected={choice === minutes}
                disabled={untilMinutes != null && minutes > untilMinutes}
                onClick={() => onChoiceChange(minutes)}
              />
            ))}
            {untilMinutes != null ? (
              <Chip
                label={UNTIL_MEETING_LABEL}
                selected={choice === 'until'}
                onClick={() => onChoiceChange('until')}
              />
            ) : null}
          </div>
          <div className="flex items-center justify-center gap-3">
            <button
              type="submit"
              data-testid="focus-start"
              className="rounded-full border border-white/20 bg-white/15 px-[length:var(--btn-px)] py-[length:var(--btn-py)] text-[length:var(--type-button)] font-medium tracking-wide text-orb-text hover:bg-white/25"
            >
              {START_LABEL}
            </button>
            <span
              data-testid="enter-hint"
              data-text-clear
              className={`text-[length:var(--type-hint)] tracking-wide text-orb-quiet transition-opacity duration-300 ${
                chromeVisible ? 'opacity-100' : 'opacity-0'
              }`}
            >
              {ENTER_HINT}
            </span>
          </div>
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
          <div className="flex items-center gap-4">
            <button
              type="button"
              data-testid="keep-going"
              onClick={onKeepGoing}
              className="rounded-full bg-white/12 px-[length:var(--btn-px)] py-[length:var(--btn-py)] text-[length:var(--type-button)] text-orb-text"
            >
              {KEEP_GOING_LABEL}
            </button>
            <button
              type="button"
              data-testid="end-focus"
              onClick={onEnd}
              className="text-[length:var(--type-button)] text-orb-quiet hover:text-orb-dim"
            >
              {END_LABEL}
            </button>
          </div>
        </div>
      ) : null}

      {surface === 'completed' && completedTask != null && completedMinutes != null ? (
        <div className="space-y-3">
          <div
            data-text-clear
            data-testid="focus-completed"
            className="text-[length:var(--type-heading)] leading-tight text-orb-text"
          >
            {formatCompleted(completedMinutes, completedTask)}
          </div>
          <div className="flex items-center gap-4">
            <button
              type="button"
              data-testid="take-break"
              onClick={onBreak}
              className="text-[length:var(--type-button)] text-orb-quiet hover:text-orb-dim"
            >
              {DONE_LABEL}
            </button>
            <button
              type="button"
              data-testid="another-round"
              onClick={onAnotherRound}
              className="rounded-full bg-white/12 px-[length:var(--btn-px)] py-[length:var(--btn-py)] text-[length:var(--type-button)] text-orb-text"
            >
              {ANOTHER_ROUND_LABEL}
            </button>
          </div>
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
