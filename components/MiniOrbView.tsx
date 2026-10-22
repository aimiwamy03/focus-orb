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
    const stage = node.parentElement;
    if (stage) observer.observe(stage);
    const win = node.ownerDocument.defaultView;
    win?.addEventListener('resize', measure);
    win?.visualViewport?.addEventListener('resize', measure);
    return () => {
      node.removeEventListener('click', handler);
      observer.disconnect();
      win?.removeEventListener('resize', measure);
      win?.visualViewport?.removeEventListener('resize', measure);
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
        display: 'flex',
        flexDirection: 'column',
        ...style,
      }}
    >
      <div
        data-testid="mini-orb-stage"
        style={{
          flex: '1 1 auto',
          minHeight: 0,
          width: '100%',
          position: 'relative',
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
      </div>
      <div
        data-testid="mini-status"
        data-text-clear
        style={{
          flex: '0 0 auto',
          boxSizing: 'border-box',
          padding: `${MINI_STATUS_PAD_Y}px ${MINI_STATUS_PAD_X}px`,
          textAlign: 'center',
          fontSize: 11,
          lineHeight: `${MINI_STATUS_LINE}px`,
          color: '#b4b4b4',
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
