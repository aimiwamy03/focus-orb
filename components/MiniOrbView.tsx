'use client';

import { CSSProperties, MutableRefObject, useEffect, useRef, useState } from 'react';
import { sizeMiniCanvas } from '@/lib/drawMiniOrb';
import { MINI_BG, miniStatusType } from '@/lib/miniOrb';

interface MiniOrbViewProps {
  status: string;
  canvasRef: React.Ref<HTMLCanvasElement>;
  style?: CSSProperties;
}

export function MiniOrbView({ status, canvasRef, style }: MiniOrbViewProps) {
  const localRef = useRef<HTMLCanvasElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [type, setType] = useState(() => miniStatusType());

  const setRefs = (node: HTMLCanvasElement | null) => {
    localRef.current = node;
    if (typeof canvasRef === 'function') canvasRef(node);
    else if (canvasRef) {
      (canvasRef as MutableRefObject<HTMLCanvasElement | null>).current = node;
    }
  };

  useEffect(() => {
    const node = localRef.current;
    const root = rootRef.current;
    if (!node) return;
    const measure = () => {
      sizeMiniCanvas(node);
      const box = root ?? node.parentElement?.parentElement;
      if (box) {
        setType(miniStatusType(box.clientWidth, box.clientHeight));
      }
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    const stage = node.parentElement;
    if (stage) observer.observe(stage);
    if (root) observer.observe(root);
    const win = node.ownerDocument.defaultView;
    win?.addEventListener('resize', measure);
    win?.visualViewport?.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      win?.removeEventListener('resize', measure);
      win?.visualViewport?.removeEventListener('resize', measure);
    };
  }, []);

  return (
    <div
      ref={rootRef}
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
          padding: `${type.padY}px ${type.padX}px`,
          textAlign: 'center',
          fontSize: type.fontSize,
          lineHeight: `${type.lineHeight}px`,
          color: '#d0d0d0',
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
