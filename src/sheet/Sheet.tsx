import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { SheetSnap } from '../store';

const HEIGHTS: Record<SheetSnap, number> = { peek: 0.24, half: 0.55, full: 0.92 };
const ORDER: SheetSnap[] = ['peek', 'half', 'full'];

/**
 * Draggable bottom sheet with three snap points. Drag the grabber/header;
 * the body scrolls on its own so menus stay readable one-handed.
 */
export function Sheet({
  snap,
  onSnap,
  header,
  children,
  label,
  flush = false,
}: {
  snap: SheetSnap;
  onSnap: (s: SheetSnap) => void;
  header?: ReactNode;
  children: ReactNode;
  label: string;
  /** Content runs edge to edge under a floating grabber (the restaurant hero). */
  flush?: boolean;
}) {
  const [drag, setDrag] = useState<number | null>(null);
  const start = useRef<{ y: number; h: number; moved: boolean } | null>(null);
  const [vh, setVh] = useState(() => window.innerHeight);

  useEffect(() => {
    const r = () => setVh(window.innerHeight);
    window.addEventListener('resize', r);
    return () => window.removeEventListener('resize', r);
  }, []);

  const height = drag ?? HEIGHTS[snap] * vh;

  const onDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button, a, input, select, textarea')) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    start.current = { y: e.clientY, h: HEIGHTS[snap] * vh, moved: false };
  };
  const onMove = (e: React.PointerEvent) => {
    if (!start.current) return;
    const dy = start.current.y - e.clientY;
    if (Math.abs(dy) > 4) start.current.moved = true;
    if (start.current.moved) setDrag(Math.min(vh * 0.95, Math.max(vh * 0.12, start.current.h + dy)));
  };
  const onUp = () => {
    const s = start.current;
    start.current = null;
    if (!s) return;
    if (!s.moved) {
      // Tap on the grabber cycles peek -> half -> full -> half.
      onSnap(snap === 'full' ? 'half' : ORDER[ORDER.indexOf(snap) + 1]);
      setDrag(null);
      return;
    }
    const h = (drag ?? s.h) / vh;
    const nearest = ORDER.reduce((a, b) => (Math.abs(HEIGHTS[b] - h) < Math.abs(HEIGHTS[a] - h) ? b : a));
    setDrag(null);
    onSnap(nearest);
  };

  return (
    <section
      className={`sheet sheet--${snap}${drag != null ? ' is-dragging' : ''}${flush ? ' is-flush' : ''}`}
      style={{ height }}
      aria-label={label}
      data-snap={snap}
    >
      <div className="sheet-head" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
        <button
          type="button"
          className="grabber"
          aria-label={snap === 'full' ? 'Shrink panel' : 'Expand panel'}
          onClick={() => onSnap(snap === 'full' ? 'half' : ORDER[ORDER.indexOf(snap) + 1])}
        />
        {header}
      </div>
      <div className="sheet-body">{children}</div>
    </section>
  );
}
