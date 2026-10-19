'use client';

import { CSSProperties, MutableRefObject, useEffect, useRef } from 'react';
import { sizeMiniCanvas } from '@/lib/drawMiniOrb';
import {
  MINI_BG,
  MINI_STATUS_LINE,
  MINI_STATUS_PAD_X,
  MINI_STATUS_PAD_Y,
} from '@/lib/miniOrb';

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
    const measure = () => sizeMiniCanvas(node);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    const win = node.ownerDocument.defaultView;
    win?.addEventListener('resize', measure);
    return () => {
      node.removeEventListener('click', handler);
      observer.disconnect();
      win?.removeEventListener('resize', measure);
    };
  }, []);

  return (
    <div
      data-testid="mini-orb"
      style={{
        width: '100%',
        height: '100%',
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
          bottom: 0,
          left: 0,
          right: 0,
          boxSizing: 'border-box',
          padding: `${MINI_STATUS_PAD_Y}px ${MINI_STATUS_PAD_X}px`,
          textAlign: 'center',
          fontSize: 11,
          lineHeight: `${MINI_STATUS_LINE}px`,
          color: 'rgba(255,255,255,0.5)',
          pointerEvents: 'none',
          letterSpacing: '0.04em',
          zIndex: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {status}
      </div>
    </div>
  );
}
