'use client';

interface StatusLineProps {
  text: string;
  joinUrl?: string | null;
}

export function StatusLine({ text, joinUrl }: StatusLineProps) {
  return (
    <div
      data-testid="status-line"
      className="pointer-events-none absolute left-1/2 z-20 -translate-x-1/2 px-4 text-center text-xs font-normal tracking-wide text-white/45"
      style={{ top: 'calc(50% + min(22vw, 22vh))' }}
    >
      <span>{text}</span>
      {joinUrl ? (
        <>
          {' '}
          <a
            href={joinUrl}
            target="_blank"
            rel="noreferrer"
            className="pointer-events-auto underline decoration-white/30 underline-offset-2 hover:text-white/60"
          >
            Join
          </a>
        </>
      ) : null}
    </div>
  );
}
