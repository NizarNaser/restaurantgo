import { useCallback, useEffect, useRef, useState } from 'react';

interface FabPosition {
  right: number;
  bottom: number;
}

// How far the pointer must move before a press counts as a drag rather
// than a click — keeps the button's onClick (open/close) working for taps.
const DRAG_THRESHOLD = 4;
const EDGE_MARGIN = 8;

function clampToViewport(pos: FabPosition, size: number): FabPosition {
  const maxRight = Math.max(EDGE_MARGIN, window.innerWidth - size - EDGE_MARGIN);
  const maxBottom = Math.max(EDGE_MARGIN, window.innerHeight - size - EDGE_MARGIN);
  return {
    right: Math.min(Math.max(pos.right, EDGE_MARGIN), maxRight),
    bottom: Math.min(Math.max(pos.bottom, EDGE_MARGIN), maxBottom),
  };
}

function readStoredPosition(storageKey: string, size: number): FabPosition | null {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.right !== 'number' || typeof parsed?.bottom !== 'number') return null;
    return clampToViewport(parsed, size);
  } catch {
    return null;
  }
}

/**
 * Makes a fixed-position floating button draggable to anywhere on screen,
 * remembering the chosen spot (per `storageKey`) across reloads.
 */
export function useDraggableFab(storageKey: string, defaultPos: FabPosition, size = 56) {
  const [pos, setPos] = useState<FabPosition>(() => readStoredPosition(storageKey, size) ?? clampToViewport(defaultPos, size));
  const draggingRef = useRef(false);
  const movedRef = useRef(false);
  const startRef = useRef({ x: 0, y: 0, right: 0, bottom: 0 });

  useEffect(() => {
    const onResize = () => setPos((p) => clampToViewport(p, size));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [size]);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLElement>) => {
    draggingRef.current = true;
    movedRef.current = false;
    startRef.current = { x: e.clientX, y: e.clientY, right: pos.right, bottom: pos.bottom };
    e.currentTarget.setPointerCapture(e.pointerId);
  }, [pos]);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLElement>) => {
    if (!draggingRef.current) return;
    const dx = e.clientX - startRef.current.x;
    const dy = e.clientY - startRef.current.y;
    if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) movedRef.current = true;
    setPos(clampToViewport({ right: startRef.current.right - dx, bottom: startRef.current.bottom - dy }, size));
  }, [size]);

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLElement>) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    e.currentTarget.releasePointerCapture(e.pointerId);
    if (movedRef.current) {
      setPos((p) => {
        try { localStorage.setItem(storageKey, JSON.stringify(p)); } catch { /* storage unavailable, keep in-memory position */ }
        return p;
      });
    }
  }, [storageKey]);

  // Call from onClick to tell a drag-release apart from a tap.
  const wasDragged = useCallback(() => movedRef.current, []);

  return { pos, dragHandlers: { onPointerDown, onPointerMove, onPointerUp }, wasDragged };
}
