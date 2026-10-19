'use client';

import { FormEvent, useEffect, useState } from 'react';
import {
  ANOTHER_ROUND_LABEL,
  ASK_PROMPT,
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
  TAKE_BREAK_LABEL,
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
  chromeVisible?: boolean;
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
      className={`rounded-full px-3 py-1 text-[11px] tracking-wide transition-colors ${
        disabled
          ? 'text-white/20'
          : selected
            ? 'bg-white/10 text-white/80'
            : 'text-white/40 hover:text-white/65'
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
  chromeVisible = false,
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
      className="relative z-20 flex w-[min(22rem,86vw)] shrink-0 flex-col items-center gap-2.5 text-center"
    >
      {surface === 'ask' && contextLine ? (
        <div
          data-testid="prompt-context"
          data-text-clear
          className="text-[11px] leading-5 text-white/40"
        >
          {contextLine}
        </div>
      ) : null}

      {surface === 'ask' ? (
        <form onSubmit={onSubmit} className="flex w-full flex-col items-center gap-2.5">
          <label data-text-clear className="text-[13px] tracking-wide text-white/55">
            {ASK_PROMPT}
          </label>
          <input
            data-testid="focus-task"
            value={task}
            onChange={(event) => onTaskChange(event.target.value)}
            placeholder={FALLBACK_TASK}
            autoComplete="off"
            className="w-full bg-transparent text-center text-[15px] text-white/80 outline-none placeholder:text-white/20"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.18)', paddingBottom: 6 }}
          />
          {mounted && recentTasks.length > 0 ? (
            <div className="flex flex-wrap justify-center gap-1.5">
              {recentTasks.map((item) => (
                <button
                  key={item}
                  type="button"
                  data-testid={`recent-${item}`}
                  onClick={() => onTaskChange(item)}
                  className="rounded-full px-2.5 py-0.5 text-[10px] text-white/35 hover:text-white/60"
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
          <div className="flex items-center justify-center gap-2">
            <button
              type="submit"
              data-testid="focus-start"
              className="text-[12px] tracking-wide text-white/55 hover:text-white/80"
            >
              {START_LABEL}
            </button>
            <span
              data-testid="enter-hint"
              data-text-clear
              className={`text-[10px] tracking-wide text-white/30 transition-opacity duration-300 ${
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
          <div data-text-clear data-testid="focus-task-name" className="text-[13px] text-white/70">
            {focusing.task}
          </div>
          <div data-text-clear data-testid="focus-countdown" className="text-[12px] text-white/45">
            {focusing.countdown}
          </div>
          <div
            data-testid="space-hint"
            data-text-clear
            className={`text-[10px] tracking-wide text-white/30 transition-opacity duration-300 ${
              chromeVisible ? 'opacity-100' : 'opacity-0'
            }`}
          >
            {SPACE_HINT}
          </div>
        </div>
      ) : null}

      {surface === 'stop-confirm' ? (
        <div className="space-y-3">
          <div data-text-clear className="text-[13px] text-white/60">
            {END_EARLY_PROMPT}
          </div>
          <div className="flex items-center gap-4">
            <button
              type="button"
              data-testid="keep-going"
              onClick={onKeepGoing}
              className="rounded-full bg-white/10 px-3.5 py-1.5 text-[12px] text-white/75"
            >
              {KEEP_GOING_LABEL}
            </button>
            <button
              type="button"
              data-testid="end-focus"
              onClick={onEnd}
              className="text-[12px] text-white/35 hover:text-white/55"
            >
              {END_LABEL}
            </button>
          </div>
        </div>
      ) : null}

      {surface === 'completed' && completedTask != null && completedMinutes != null ? (
        <div className="space-y-3">
          <div data-text-clear data-testid="focus-completed" className="text-[13px] text-white/65">
            {formatCompleted(completedMinutes, completedTask)}
          </div>
          <div className="flex items-center gap-4">
            <button
              type="button"
              data-testid="take-break"
              onClick={onBreak}
              className="text-[12px] text-white/45 hover:text-white/70"
            >
              {TAKE_BREAK_LABEL}
            </button>
            <button
              type="button"
              data-testid="another-round"
              onClick={onAnotherRound}
              className="rounded-full bg-white/10 px-3.5 py-1.5 text-[12px] text-white/75"
            >
              {ANOTHER_ROUND_LABEL}
            </button>
          </div>
        </div>
      ) : null}

      {surface === 'break' ? (
        <div data-text-clear data-testid="focus-break" className="text-[13px] text-white/45">
          {formatBreakCopy(focusMinutes ?? 0)}
        </div>
      ) : null}
    </div>
  );
}
