'use client';

import {
  BACKDROP_AVIF,
  BACKDROP_HEIGHT,
  BACKDROP_WEBP,
  BACKDROP_WIDTH,
} from '@/lib/backdrop';

export function StarDustBackdrop({ enabled }: { enabled: boolean }) {
  if (!enabled) return null;
  return (
    <div className="star-dust" data-testid="star-dust-backdrop" aria-hidden>
      <picture>
        <source type="image/avif" srcSet={BACKDROP_AVIF} />
        <img
          src={BACKDROP_WEBP}
          alt=""
          width={BACKDROP_WIDTH}
          height={BACKDROP_HEIGHT}
          decoding="async"
          fetchPriority="low"
        />
      </picture>
      <div className="star-dust-dim" />
    </div>
  );
}
