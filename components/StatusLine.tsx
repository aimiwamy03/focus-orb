'use client';

interface StatusLineProps {
  text: string;
  detail?: string;
  hovered?: boolean;
  joinUrl?: string | null;
}

export function StatusLine({
  text,
  detail,
  hovered = false,
  joinUrl,
}: StatusLineProps) {
  return (
    <div
      data-testid="status-line"
      className={`pointer-events-none z-20 w-fit max-w-[min(36rem,80vw)] shrink-0 text-center font-normal tracking-wide transition-colors duration-200 ${
        hovered ? 'text-orb-text' : 'text-orb-dim'
      }`}
    >
      <div className="text-[12px] leading-5">
        <span data-text-clear className="inline-block">
          {text}
          {joinUrl ? (
            <>
              {' '}
              <a
                href={joinUrl}
                target="_blank"
                rel="noreferrer"
                className={`pointer-events-auto underline underline-offset-2 ${
                  hovered
                    ? 'text-orb-text decoration-orb-dim'
                    : 'text-orb-dim decoration-orb-quiet'
                }`}
              >
                Join
              </a>
            </>
          ) : null}
        </span>
      </div>
      {hovered && detail ? (
        <div
          data-testid="status-detail"
          data-text-clear
          className="mt-1 inline-block text-[10px] leading-4 text-orb-dim"
        >
          {detail}
        </div>
      ) : null}
    </div>
  );
}
