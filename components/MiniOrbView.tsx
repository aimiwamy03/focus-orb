'use client';

import { CSSProperties, MutableRefObject, useEffect, useRef } from 'react';
import { MINI_BG, MINI_SIZE } from '@/lib/miniOrb';

interface MiniOrbViewProps {
  status: string;
  canvasRef: React.Ref<HTMLCanvasElement>;
  onClick: () => void;
  style?: CSSProperties;
}

export function MiniOrbView({ status, canvasRef, onClick, style }: MiniOrbViewProps) {
  const localRef = useRef<HTMLCanvasElement | null>(null);
  const onClickRef = useRef(onClick);
  onClickRef.current = onClick;

  const setRefs = (node: HTMLCanvasElement | null) => {
    localRef.current = node;
    if (typeof canvasRef === 'function') canvasRef(node);
    else if (canvasRef) {
      (canvasRef as MutableRefObject<HTMLCanvasElement | null>).current = node;
    }
  };

  useEffect(() => {
    const node = localRef.current;
    if (!node) return;
    const handler = () => onClickRef.current();
    node.addEventListener('click', handler);
    return () => node.removeEventListener('click', handler);
  }, []);

  return (
    <div
      data-testid="mini-orb"
      style={{
        width: MINI_SIZE,
        height: MINI_SIZE,
        background: MINI_BG,
        position: 'relative',
        overflow: 'hidden',
        fontFamily: 'system-ui, sans-serif',
        ...style,
      }}
    >
      <canvas
        data-testid="mini-orb-canvas"
        ref={setRefs}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          cursor: 'pointer',
          display: 'block',
        }}
      />
      <div
        data-testid="mini-status"
        data-text-clear
        style={{
          position: 'absolute',
          bottom: 10,
          left: 8,
          right: 8,
          textAlign: 'center',
          fontSize: 11,
          lineHeight: '14px',
          color: 'rgba(255,255,255,0.5)',
          pointerEvents: 'none',
          letterSpacing: '0.04em',
          zIndex: 1,
        }}
      >
        {status}
      </div>
    </div>
  );
}
