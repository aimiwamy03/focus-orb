'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MiniOrbView } from '@/components/MiniOrbView';
import { canUseDocumentPip, MINI_SIZE } from '@/lib/miniOrb';

function stylePipDocument(doc: Document) {
  doc.documentElement.style.height = '100%';
  doc.body.style.margin = '0';
  doc.body.style.background = '#000';
  doc.body.style.overflow = 'hidden';
  doc.body.style.width = `${MINI_SIZE}px`;
  doc.body.style.height = `${MINI_SIZE}px`;
}

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

  const close = useCallback(() => {
    const win = winRef.current;
    winRef.current = null;
    setContainer(null);
    if (win && !win.closed) {
      try {
        win.close();
      } catch {
        // already gone
      }
    }
  }, []);

  const handlePageHide = useCallback(() => {
    winRef.current = null;
    setContainer(null);
    onClosedRef.current();
  }, []);

  const open = useCallback(async (): Promise<boolean> => {
    if (!options.supported || !canUseDocumentPip()) return false;
    if (winRef.current && !winRef.current.closed) return true;
    try {
      const pip = window.documentPictureInPicture;
      if (!pip) return false;
      const win = await pip.requestWindow({ width: MINI_SIZE, height: MINI_SIZE });
      stylePipDocument(win.document);
      const root = win.document.createElement('div');
      win.document.body.appendChild(root);
      winRef.current = win;
      setContainer(root);
      win.addEventListener('pagehide', handlePageHide);
      return true;
    } catch {
      return false;
    }
  }, [handlePageHide, options.supported]);

  useEffect(() => {
    return () => {
      const win = winRef.current;
      if (win) {
        win.removeEventListener('pagehide', handlePageHide);
        try {
          win.close();
        } catch {
          // ignore
        }
      }
    };
  }, [handlePageHide]);

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
