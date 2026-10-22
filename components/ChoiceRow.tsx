'use client';

import { MouseEvent } from 'react';

export interface ChoiceItem {
  id: string;
  label: string;
  disabled?: boolean;
}

function keepButtonUnfocused(event: MouseEvent<HTMLButtonElement>) {
  event.preventDefault();
}

function hitClass(disabled: boolean): string {
  return `inline-flex min-h-[44px] items-center justify-center bg-transparent ${
    disabled ? 'cursor-default' : 'cursor-pointer'
  }`;
}

export function ChoiceRow({
  items,
  highlighted,
  onHighlight,
  onConfirm,
  testId,
  tone = 'button',
  underlined = -1,
  confirmOnClick = true,
}: {
  items: ChoiceItem[];
  highlighted: number;
  onHighlight: (index: number) => void;
  onConfirm: (index: number) => void;
  testId: string;
  tone?: 'button' | 'chip' | 'quiet';
  underlined?: number;
  confirmOnClick?: boolean;
}) {
  return (
    <div
      role="group"
      data-testid={testId}
      className={`flex flex-wrap items-center justify-center ${
        tone === 'chip' || tone === 'quiet' ? 'gap-1' : 'gap-4'
      }`}
    >
      {items.map((item, index) => {
        const active = highlighted === index && !item.disabled;
        return (
          <button
            key={item.id}
            type="button"
            tabIndex={-1}
            data-testid={item.id}
            data-highlighted={active ? 'true' : 'false'}
            data-whoop-adapt={underlined === index ? 'true' : 'false'}
            disabled={item.disabled}
            aria-pressed={active}
            onMouseDown={keepButtonUnfocused}
            onMouseEnter={() => {
              if (!item.disabled) onHighlight(index);
            }}
            onClick={() => {
              if (item.disabled) return;
              onHighlight(index);
              if (confirmOnClick) onConfirm(index);
            }}
            className={hitClass(Boolean(item.disabled))}
          >
            <span
              className={`${choiceClass(tone, active, Boolean(item.disabled))} ${
                underlined === index
                  ? 'underline decoration-1 underline-offset-[6px]'
                  : ''
              }`}
            >
              {item.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function choiceClass(
  tone: 'button' | 'chip' | 'quiet',
  highlighted: boolean,
  disabled: boolean
): string {
  const ring = 'outline-none focus:outline-none focus-visible:outline-none';
  if (disabled) {
    return `${ring} rounded-full px-3.5 py-1.5 text-[length:var(--type-chip)] tracking-wide text-orb-placeholder`;
  }
  if (highlighted) {
    return `${ring} rounded-full px-3.5 py-1.5 text-[length:var(--type-button)] tracking-wide bg-orb-highlight text-orb-text ring-2 ring-orb-ring`;
  }
  if (tone === 'quiet') {
    return `${ring} rounded-full px-3.5 py-1.5 text-[length:var(--type-button)] tracking-wide text-orb-quiet hover:text-orb-text`;
  }
  if (tone === 'chip') {
    return `${ring} rounded-full px-3.5 py-1.5 text-[length:var(--type-chip)] tracking-wide text-orb-dim hover:text-orb-text`;
  }
  return `${ring} rounded-full px-[length:var(--btn-px)] py-[length:var(--btn-py)] text-[length:var(--type-button)] text-orb-quiet hover:text-orb-dim`;
}
