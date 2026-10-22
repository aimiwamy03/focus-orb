'use client';

import { useCallback, useEffect, useRef } from 'react';
import {
  INTRO_ART_FALLBACK,
  INTRO_ART_SRC,
  INTRO_AUDIO,
  INTRO_LINES,
  INTRO_MIN_CAPTION_PX,
  INTRO_SKIP_HINT,
  INTRO_SKIP_MS,
  INTRO_TIMELINE,
  introClockSpeed,
  introFrame,
  introSoundCuesAt,
  isIntroSkipKey,
  type IntroAudioName,
} from '@/lib/intro';

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function FocusIntro({
  soundEnabled,
  reducedMotion,
  freezeAt = null,
  onDone,
}: {
  soundEnabled: boolean;
  reducedMotion: boolean;
  freezeAt?: number | null;
  onDone: () => void;
}) {
  const reduced = reducedMotion || prefersReducedMotion();
  const overlayRef = useRef<HTMLDivElement>(null);
  const artRef = useRef<HTMLImageElement>(null);
  const vigRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<HTMLDivElement>(null);
  const cubeRef = useRef<HTMLDivElement>(null);
  const restRef = useRef<HTMLDivElement>(null);
  const copyRef = useRef<HTMLSpanElement>(null);
  const hintRef = useRef<HTMLParagraphElement>(null);
  const faceRefs = useRef<Array<HTMLDivElement | null>>([]);
  const rafRef = useRef(0);
  const startRef = useRef(0);
  const doneRef = useRef(false);
  const skippingRef = useRef(false);
  const depthRef = useRef(0);
  const waitingGestureRef = useRef(false);
  const startingAudioRef = useRef(false);
  const soundEnabledRef = useRef(soundEnabled);
  soundEnabledRef.current = soundEnabled;
  const audioRef = useRef<{
    ctx: AudioContext;
    gain: GainNode;
    sources: AudioBufferSourceNode[];
  } | null>(null);

  const layout = useCallback(() => {
    const rest = restRef.current;
    const copy = copyRef.current;
    const scene = sceneRef.current;
    if (!rest || !copy || !scene) return;
    copy.style.fontSize = '';
    copy.style.letterSpacing = '';
    const fs = Math.max(INTRO_MIN_CAPTION_PX, parseFloat(getComputedStyle(copy).fontSize) || INTRO_MIN_CAPTION_PX);
    const width = Math.round(window.innerWidth * 0.92);
    const shown = copy.textContent;
    copy.textContent = INTRO_LINES[1];
    const height = Math.max(Math.round(fs * 1.85), Math.round(copy.scrollHeight));
    const depth = height / 2;
    depthRef.current = depth;
    const root = overlayRef.current;
    if (root) {
      root.style.setProperty('--intro-w', `${width}px`);
      root.style.setProperty('--intro-h', `${height}px`);
    }
    scene.style.perspective = '1200px';
    faceRefs.current.forEach((face, i) => {
      if (!face) return;
      face.style.transform = `rotateX(${-i * 90}deg) translateZ(${depth}px)`;
    });
    copy.textContent = shown;
  }, []);

  const applyFrame = useCallback(
    (t: number) => {
      const frame = introFrame(t, reduced);
      const art = artRef.current;
      const vig = vigRef.current;
      const scene = sceneRef.current;
      const cube = cubeRef.current;
      const rest = restRef.current;
      const copy = copyRef.current;
      const hint = hintRef.current;
      const overlay = overlayRef.current;
      if (art) {
        art.style.opacity = String(frame.artOpacity);
        art.style.transform = frame.artTransform;
        art.style.filter = frame.artFilter;
      }
      if (vig) vig.style.opacity = String(frame.vigOpacity);
      if (scene) scene.style.visibility = frame.sceneVisible ? 'visible' : 'hidden';
      if (cube) {
        const d = depthRef.current;
        cube.style.transform = frame.sceneVisible
          ? `translateZ(${-d}px) rotateX(${frame.cubeAngle}deg)`
          : 'none';
      }
      if (rest) {
        rest.style.opacity = String(frame.restOpacity);
        rest.style.transform = frame.restScale === 1 ? 'none' : `scale(${frame.restScale})`;
      }
      if (copy) {
        copy.textContent = frame.restText;
        copy.style.textShadow =
          frame.restGlow > 0
            ? `0 0 ${14 * frame.restGlow}px rgba(255,255,255,${0.45 * frame.restGlow}), 0 0 18px rgba(0,0,0,.9), 0 0 4px rgba(0,0,0,.85)`
            : '';
      }
      if (hint) hint.style.opacity = String(frame.hintOpacity);
      if (overlay && !skippingRef.current) overlay.style.opacity = String(frame.overlayOpacity);
      return frame.done;
    },
    [reduced]
  );

  const stopAudio = useCallback((fade = 0.06) => {
    const run = audioRef.current;
    if (!run) return;
    audioRef.current = null;
    const now = run.ctx.currentTime;
    try {
      run.gain.gain.cancelScheduledValues(now);
      run.gain.gain.setValueAtTime(run.gain.gain.value, now);
      run.gain.gain.linearRampToValueAtTime(0, now + fade);
    } catch {
      /* fail silent */
    }
    window.setTimeout(() => {
      run.sources.forEach((src) => {
        try {
          src.stop();
        } catch {
          /* already stopped */
        }
      });
      try {
        run.gain.disconnect();
      } catch {
        /* ignore */
      }
    }, fade * 1000 + 50);
  }, []);

  const startAudio = useCallback(async () => {
    if (!soundEnabledRef.current || audioRef.current || startingAudioRef.current || doneRef.current) {
      return;
    }
    startingAudioRef.current = true;
    try {
      const AC =
        window.AudioContext ||
        (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      const ctx = new AC();
      await ctx.resume();
      if (ctx.state !== 'running') {
        waitingGestureRef.current = true;
        await ctx.close().catch(() => undefined);
        return;
      }
      waitingGestureRef.current = false;
      const names = Object.keys(INTRO_AUDIO) as IntroAudioName[];
      const buffers = Object.fromEntries(
        await Promise.all(
          names.map(async (name) => {
            const res = await fetch(INTRO_AUDIO[name]);
            const buf = await ctx.decodeAudioData(await res.arrayBuffer());
            return [name, buf] as const;
          })
        )
      ) as Record<IntroAudioName, AudioBuffer>;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -3;
      comp.ratio.value = 8;
      comp.attack.value = 0.002;
      comp.release.value = 0.1;
      comp.connect(ctx.destination);
      const gain = ctx.createGain();
      gain.connect(comp);
      const elapsed = startRef.current
        ? ((performance.now() - startRef.current) / 1000) * introClockSpeed(reduced)
        : 0;
      const t0 = ctx.currentTime + 0.02;
      const sources = introSoundCuesAt(elapsed).flatMap((cue) => {
        const buffer = buffers[cue.name];
        if (!buffer || cue.offset >= buffer.duration) return [];
        const src = ctx.createBufferSource();
        src.buffer = buffer;
        const g = ctx.createGain();
        g.gain.value = cue.volume;
        src.connect(g);
        g.connect(gain);
        src.start(Math.max(t0 + cue.when, ctx.currentTime), cue.offset);
        return [src];
      });
      audioRef.current = { ctx, gain, sources };
    } catch {
      waitingGestureRef.current = true;
    } finally {
      startingAudioRef.current = false;
    }
  }, [reduced]);

  const finish = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    waitingGestureRef.current = false;
    cancelAnimationFrame(rafRef.current);
    stopAudio(0.15);
    onDone();
  }, [onDone, stopAudio]);

  const skip = useCallback(() => {
    if (doneRef.current || skippingRef.current) return;
    skippingRef.current = true;
    cancelAnimationFrame(rafRef.current);
    const overlay = overlayRef.current;
    if (overlay) {
      overlay.classList.add('focus-intro-fade');
      overlay.style.opacity = '0';
    }
    stopAudio(0.15);
    window.setTimeout(() => finish(), INTRO_SKIP_MS);
  }, [finish, stopAudio]);

  useEffect(() => {
    layout();
    const onResize = () => layout();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [layout]);

  useEffect(() => {
    doneRef.current = false;
    skippingRef.current = false;
    if (freezeAt != null) {
      applyFrame(freezeAt);
      return;
    }
    const speed = introClockSpeed(reduced);
    const tick = (now: number) => {
      if (!startRef.current) startRef.current = now;
      const t = ((now - startRef.current) / 1000) * speed;
      const done = applyFrame(Math.min(t, INTRO_TIMELINE.total));
      if (done) finish();
      else rafRef.current = requestAnimationFrame(tick);
    };
    applyFrame(0);
    void startAudio();
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafRef.current);
      stopAudio();
    };
  }, [applyFrame, finish, freezeAt, reduced, startAudio, stopAudio]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (waitingGestureRef.current && !isIntroSkipKey(event.key)) {
        event.preventDefault();
        void startAudio();
        return;
      }
      if (!isIntroSkipKey(event.key)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      skip();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [skip, startAudio]);

  return (
    <div
      ref={overlayRef}
      data-testid="focus-intro"
      className="focus-intro"
      role="dialog"
      aria-label="Opening intro"
      onPointerDown={() => {
        if (waitingGestureRef.current) {
          void startAudio();
          return;
        }
        skip();
      }}
    >
      <link rel="preload" as="image" href={INTRO_ART_SRC} />
      <div className="focus-intro-art-frame">
        <img
          ref={artRef}
          data-testid="focus-intro-art"
          className="focus-intro-art"
          src={INTRO_ART_SRC}
          alt=""
          width={2400}
          height={1347}
          fetchPriority="high"
          onError={(event) => {
            event.currentTarget.src = INTRO_ART_FALLBACK;
          }}
        />
      </div>
      <div ref={vigRef} className="focus-intro-vignette" aria-hidden />
      <div className="focus-intro-captions">
        <div ref={sceneRef} className="focus-intro-scene">
          <div ref={cubeRef} className="focus-intro-cube">
            {INTRO_LINES.map((line, index) => (
              <div
                key={`face-${index}`}
                ref={(node) => {
                  faceRefs.current[index] = node;
                }}
                className="focus-intro-face"
              >
                <span className="focus-intro-copy">{line}</span>
              </div>
            ))}
          </div>
        </div>
        <div ref={restRef} className="focus-intro-rest">
          <span ref={copyRef} data-testid="focus-intro-caption" className="focus-intro-copy" />
        </div>
      </div>
      <p ref={hintRef} data-testid="focus-intro-hint" className="focus-intro-hint">
        {INTRO_SKIP_HINT}
      </p>
    </div>
  );
}
