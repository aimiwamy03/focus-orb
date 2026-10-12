'use client';

interface StatusLineProps {
  text: string;
  detail?: string;
  hovered?: boolean;
  joinUrl?: string | null;
  nudgeText?: string | null;
  nudgeButtonLabel?: string | null;
  onNudgeFocus?: () => void;
}

export function StatusLine({
  text,
  detail,
  hovered = false,
  joinUrl,
  nudgeText,
  nudgeButtonLabel,
  onNudgeFocus,
}: StatusLineProps) {
  const line = nudgeText ?? text;

  return (
    <div
      data-testid="status-line"
      className={`pointer-events-none absolute bottom-[5.75rem] left-1/2 z-20 w-[min(36rem,80vw)] -translate-x-1/2 px-4 text-center font-normal tracking-wide transition-colors duration-200 ${
        hovered ? 'text-white/[0.85]' : 'text-white/45'
      }`}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-28 w-[32rem] max-w-[90vw] -translate-x-1/2 -translate-y-1/2"
        style={{
          background:
            'radial-gradient(ellipse at center, rgba(22,22,22,0.80) 0%, rgba(22,22,22,0.55) 42%, rgba(22,22,22,0) 72%)',
        }}
      />
      <div className="relative text-[12px] leading-5">
        <span data-text-clear className="inline-block">
          {line}
          {nudgeText && nudgeButtonLabel && onNudgeFocus ? (
            <>
              {' '}
              <button
                type="button"
                data-testid="nudge-focus"
                onClick={onNudgeFocus}
                className={`pointer-events-auto underline underline-offset-2 ${
                  hovered
                    ? 'text-white/[0.85] decoration-white/50'
                    : 'text-white/50 decoration-white/40'
                }`}
              >
                {nudgeButtonLabel}
              </button>
            </>
          ) : null}
          {!nudgeText && joinUrl ? (
            <>
              {' '}
              <a
                href={joinUrl}
                target="_blank"
                rel="noreferrer"
                className={`pointer-events-auto underline underline-offset-2 ${
                  hovered
                    ? 'text-white/[0.85] decoration-white/50'
                    : 'text-white/50 decoration-white/40'
                }`}
              >
                Join
              </a>
            </>
          ) : null}
        </span>
      </div>
      {hovered && detail && !nudgeText ? (
        <div
          data-testid="status-detail"
          data-text-clear
          className="mt-1 inline-block text-[10px] leading-4 text-white/70"
        >
          {detail}
        </div>
      ) : null}
    </div>
  );
}
