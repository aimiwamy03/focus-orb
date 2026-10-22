'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MiniOrbView } from '@/components/MiniOrbView';
import { sizeMiniCanvas } from '@/lib/drawMiniOrb';
import { applyPipDocumentStyle, canUseDocumentPip, MINI_SIZE } from '@/lib/miniOrb';

export function useMiniWindow(options: {
  supported: boolean;
  status: string;
  onOrbClick: () => void;
  onClosed: () => void;
}) {
  const [container, setContainer] = useState<HTMLElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const winRef = useRef<Window | null>(null);
  const onClosedRef = useRef(options.onClosed);
  const onOrbClickRef = useRef(options.onOrbClick);
  onClosedRef.current = options.onClosed;
  onOrbClickRef.current = options.onOrbClick;

  const measurePip = useCallback(() => {
    const win = winRef.current;
    if (!win || win.closed) return;
    applyPipDocumentStyle(win.document, {
      width: win.innerWidth,
      height: win.innerHeight,
    });
    const root = win.document.body.firstElementChild;
    if (root instanceof HTMLElement) {
      root.style.width = `${win.innerWidth}px`;
      root.style.height = `${win.innerHeight}px`;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    // Size from the canvas CSS box (the stage above the status line),
    // never from the full window. A window-sized buffer in a shorter
    // stage is what shifts a large PiP orb up and left.
    sizeMiniCanvas(canvas);
  }, []);

  const close = useCallback(() => {
    const win = winRef.current;
    winRef.current = null;
    setContainer(null);
    onClosedRef.current();
    if (win && !win.closed) {
      try {
        win.close();
      } catch {
        // already gone
      }
    }
  }, []);

  const handlePageHide = useCallback(() => {
    const win = winRef.current;
    if (win) win.removeEventListener('resize', measurePip);
    winRef.current = null;
    setContainer(null);
    onClosedRef.current();
  }, [measurePip]);

  const open = useCallback(async (): Promise<boolean> => {
    if (!options.supported || !canUseDocumentPip()) return false;
    if (winRef.current && !winRef.current.closed) return true;
    try {
      const pip = window.documentPictureInPicture;
      if (!pip) return false;
      const win = await pip.requestWindow({ width: MINI_SIZE, height: MINI_SIZE });
      applyPipDocumentStyle(win.document, {
        width: win.innerWidth,
        height: win.innerHeight,
      });
      const root = win.document.createElement('div');
      root.style.width = `${win.innerWidth}px`;
      root.style.height = `${win.innerHeight}px`;
      win.document.body.appendChild(root);
      winRef.current = win;
      setContainer(root);
      win.addEventListener('pagehide', handlePageHide);
      win.addEventListener('resize', measurePip);
      measurePip();
      return true;
    } catch {
      return false;
    }
  }, [handlePageHide, measurePip, options.supported]);

  useEffect(() => {
    if (!container) return;
    measurePip();
  }, [container, measurePip, options.status]);

  useEffect(() => {
    return () => {
      const win = winRef.current;
      if (win) {
        win.removeEventListener('pagehide', handlePageHide);
        win.removeEventListener('resize', measurePip);
        try {
          win.close();
        } catch {
          // ignore
        }
      }
    };
  }, [handlePageHide, measurePip]);

  const portal =
    container &&
    createPortal(
      <MiniOrbView
        status={options.status}
        canvasRef={canvasRef}
        onClick={() => onOrbClickRef.current()}
      />,
      container
    );

  return {
    open,
    close,
    isOpen: Boolean(container),
    canvasRef,
    portal,
  };
}
