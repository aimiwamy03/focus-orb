'use client';

export interface ChoiceItem {
  id: string;
  label: string;
  disabled?: boolean;
}

export function ChoiceRow({
  items,
  highlighted,
  onHighlight,
  onConfirm,
  testId,
  tone = 'button',
  confirmOnClick = true,
}: {
  items: ChoiceItem[];
  highlighted: number;
  onHighlight: (index: number) => void;
  onConfirm: (index: number) => void;
  testId: string;
  tone?: 'button' | 'chip';
  confirmOnClick?: boolean;
}) {
  return (
    <div
      role="group"
      data-testid={testId}
      className={`flex flex-wrap items-center justify-center ${
        tone === 'chip' ? 'gap-1' : 'gap-4'
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
            disabled={item.disabled}
            aria-pressed={active}
            onMouseEnter={() => {
              if (!item.disabled) onHighlight(index);
            }}
            onClick={() => {
              if (item.disabled) return;
              onHighlight(index);
              if (confirmOnClick) onConfirm(index);
            }}
            className={choiceClass(tone, active, Boolean(item.disabled))}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

function choiceClass(tone: 'button' | 'chip', highlighted: boolean, disabled: boolean): string {
  const ring = 'outline-none focus:outline-none focus-visible:outline-none';
  if (tone === 'chip') {
    if (disabled) {
      return `${ring} rounded-full px-3.5 py-1.5 text-[length:var(--type-chip)] tracking-wide text-orb-placeholder`;
    }
    if (highlighted) {
      return `${ring} rounded-full px-3.5 py-1.5 text-[length:var(--type-chip)] tracking-wide bg-white/10 text-orb-text`;
    }
    return `${ring} rounded-full px-3.5 py-1.5 text-[length:var(--type-chip)] tracking-wide text-orb-dim hover:text-orb-text`;
  }
  if (highlighted) {
    return `${ring} rounded-full bg-white/12 px-[length:var(--btn-px)] py-[length:var(--btn-py)] text-[length:var(--type-button)] text-orb-text`;
  }
  return `${ring} rounded-full px-[length:var(--btn-px)] py-[length:var(--btn-py)] text-[length:var(--type-button)] text-orb-quiet hover:text-orb-dim`;
}
