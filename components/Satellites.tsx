'use client';

interface SatellitesProps {
  count: number;
}

export function Satellites({ count }: SatellitesProps) {
  if (count <= 0) return null;

  return (
    <div
      data-testid="satellites"
      data-count={count}
      className="pointer-events-none absolute inset-0 z-10"
    >
      {Array.from({ length: count }, (_, i) => {
        const t = count === 1 ? 0.45 : 0.12 + (0.42 * i) / Math.max(1, count - 1);
        const angle = t * Math.PI;
        return (
          <span
            key={i}
            className="absolute left-1/2 top-1/2 block h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/80 shadow-[0_0_6px_rgba(255,255,255,0.35)]"
            style={{
              transform: `translate(-50%, -50%) translate(calc(${Math.cos(angle)} * 26vmin), calc(${Math.sin(angle)} * 26vmin))`,
            }}
          />
        );
      })}
    </div>
  );
}
