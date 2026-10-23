'use client';

export function isSquareKeycap(label: string): boolean {
  return label.length === 1;
}

export function KeyHint({
  label,
  className = '',
}: {
  label: string;
  className?: string;
}) {
  const square = isSquareKeycap(label);
  return (
    <kbd
      data-testid={`keycap-${label}`}
      data-text-clear
      data-keycap={square ? 'square' : 'wide'}
      className={`keycap inline-flex box-border items-center justify-center border border-white/25 rounded p-0 font-normal leading-none text-orb-quiet text-[length:var(--type-key)] h-6 ${
        square ? 'keycap-square w-6' : 'keycap-wide w-auto px-2'
      } ${className}`.trim()}
    >
      {label}
    </kbd>
  );
}
