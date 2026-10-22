'use client';

export function KeyHint({
  label,
  className = '',
}: {
  label: string;
  className?: string;
}) {
  return (
    <kbd
      data-testid={`keycap-${label}`}
      data-text-clear
      className={`inline-flex h-[1.4em] min-w-[1.4em] items-center justify-center rounded border border-white/25 px-1.5 text-[length:var(--type-key)] font-normal leading-none text-orb-quiet ${className}`}
    >
      {label}
    </kbd>
  );
}
