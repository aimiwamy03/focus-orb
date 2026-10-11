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
      <div className="text-[12px] leading-5">
        <span>{line}</span>
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
      </div>
      {hovered && detail && !nudgeText ? (
        <div data-testid="status-detail" className="mt-1 text-[10px] leading-4 text-white/70">
          {detail}
        </div>
      ) : null}
    </div>
  );
}
