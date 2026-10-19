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
      className={`inline-flex h-3.5 min-w-3.5 items-center justify-center rounded border border-white/15 px-1 text-[9px] font-normal leading-none text-white/30 ${className}`}
    >
      {label}
    </kbd>
  );
}
