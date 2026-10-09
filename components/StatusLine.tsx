'use client';

interface StatusLineProps {
  text: string;
  joinUrl?: string | null;
}

export function StatusLine({ text, joinUrl }: StatusLineProps) {
  return (
    <div
      data-testid="status-line"
      className="pointer-events-none absolute bottom-[5.75rem] left-1/2 z-20 -translate-x-1/2 px-4 text-center text-[12px] font-normal tracking-wide text-white/45"
    >
      <span>{text}</span>
      {joinUrl ? (
        <>
          {' '}
          <a
            href={joinUrl}
            target="_blank"
            rel="noreferrer"
            className="pointer-events-auto text-white/50 underline decoration-white/40 underline-offset-2 hover:text-white/70"
          >
            Join
          </a>
        </>
      ) : null}
    </div>
  );
}
