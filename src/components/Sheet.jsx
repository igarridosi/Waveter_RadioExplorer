import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { X } from '@phosphor-icons/react';
import { spring, project, rubberband } from '../ui/spring.js';

const MOBILE = '(max-width: 767px)';
const REDUCED = '(prefers-reduced-motion: reduce)';

// A modal surface. On phones it is a bottom sheet you can drag down to dismiss
// (1:1 tracking, momentum projection, interruptible spring); on wider screens a
// side panel that enters and leaves along the same edge.
export default function Sheet({ open, onClose, title, children }) {
  const [mounted, setMounted] = useState(open);
  const [closing, setClosing] = useState(false);
  const isMobile = useMedia(MOBILE);
  const reduced = useMedia(REDUCED);

  useEffect(() => {
    if (open) { setMounted(true); setClosing(false); }
    else if (mounted) setClosing(true);
  }, [open, mounted]);

  const unmount = useCallback(() => { setMounted(false); setClosing(false); }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!mounted) return null;

  const common = { title, onClose, closing, onClosed: unmount, reduced, children };
  return isMobile ? <BottomSheet {...common} /> : <SidePanel {...common} />;
}

function BottomSheet({ title, onClose, closing, onClosed, reduced, children }) {
  const panel = useRef(null);
  const scrim = useRef(null);
  const closeRef = useRef(null);
  const anim = useRef(null);
  const y = useRef(0);
  const drag = useRef(null);
  const closingRef = useRef(closing);
  closingRef.current = closing;

  const height = () => panel.current?.offsetHeight || window.innerHeight;

  const render = useCallback(value => {
    y.current = value;
    if (!panel.current || !scrim.current) return;
    panel.current.style.transform = `translate3d(0, ${value}px, 0)`;
    scrim.current.style.opacity = String(Math.max(0, 1 - value / height()));
  }, []);

  const animateTo = useCallback((to, velocity, done) => {
    anim.current?.stop();
    if (reduced) { render(to); done?.(); return; }
    anim.current = spring({ from: y.current, to, velocity, response: 0.35, damping: 1, onUpdate: render, onDone: done });
  }, [reduced, render]);

  // Enter from the bottom edge.
  useLayoutEffect(() => {
    render(height());
    animateTo(0, 0);
    closeRef.current?.focus({ preventScroll: true });
    return () => anim.current?.stop();
  }, [animateTo, render]);

  // Leave along the same edge, then unmount.
  useEffect(() => {
    if (closing) animateTo(height(), 0, onClosed);
  }, [closing, animateTo, onClosed]);

  function onPointerDown(e) {
    if (closingRef.current) return;
    anim.current?.stop(); // grab it mid-flight, from where it is
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { startY: e.clientY, startOffset: y.current, history: [[e.clientY, performance.now()]] };
  }

  function onPointerMove(e) {
    const d = drag.current;
    if (!d) return;
    const delta = e.clientY - d.startY;
    let next = d.startOffset + delta;
    if (next < 0) next = rubberband(next, height()); // resist above the open position
    render(next);
    d.history.push([e.clientY, performance.now()]);
    if (d.history.length > 6) d.history.shift();
  }

  function onPointerUp() {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    const [y0, t0] = d.history[0];
    const [y1, t1] = d.history[d.history.length - 1];
    const velocity = t1 > t0 ? ((y1 - y0) / (t1 - t0)) * 1000 : 0; // px/s
    const restingPoint = y.current + project(velocity);
    // The flick's direction decides; a slow drag decides by where it would come to rest.
    const dismiss = velocity > 600 || (velocity > -200 && restingPoint > height() * 0.45);
    if (dismiss) onClose();
    else animateTo(0, velocity);
  }

  return (
    <div className="fixed inset-0 z-40">
      <div
        ref={scrim}
        onClick={onClose}
        className="absolute inset-0 bg-zinc-950/70"
        style={{ opacity: 0 }}
        aria-hidden="true"
      />
      <section
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sheet-title"
        className="glass-heavy absolute inset-x-0 bottom-0 flex max-h-[88dvh] flex-col rounded-t-[18px] pb-[env(safe-area-inset-bottom)] will-change-transform"
      >
        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className="touch-none cursor-grab select-none active:cursor-grabbing"
        >
          <div className="mx-auto mt-2.5 h-1.5 w-10 rounded-full bg-white/25" aria-hidden="true" />
          <header className="flex items-center justify-between px-5 pb-3 pt-3">
            <h2 id="sheet-title" className="text-lg font-bold text-zinc-50">{title}</h2>
            <button ref={closeRef} type="button" onClick={onClose} aria-label="Close" className="rounded-full p-2 text-zinc-300 transition-colors hover:bg-white/10 active:scale-95">
              <X size={20} weight="bold" aria-hidden="true" />
            </button>
          </header>
        </div>
        <div className="scroll-thin min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
      </section>
    </div>
  );
}

function SidePanel({ title, onClose, closing, onClosed, children }) {
  const closeRef = useRef(null);
  useEffect(() => { closeRef.current?.focus({ preventScroll: true }); }, []);

  return (
    <div className="fixed inset-0 z-40">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className={`absolute inset-0 bg-zinc-950/60 ${closing ? 'anim-fade-out' : 'anim-fade-in'}`}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="sheet-title"
        onAnimationEnd={() => { if (closing) onClosed(); }}
        className={`glass-heavy absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l border-white/10 ${closing ? 'anim-slide-out-right' : 'anim-slide-in-right'}`}
      >
        <header className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <h2 id="sheet-title" className="text-lg font-bold text-zinc-50">{title}</h2>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Close" className="rounded-full p-2 text-zinc-300 transition-colors hover:bg-white/10 hover:text-zinc-50 active:scale-95">
            <X size={20} weight="bold" aria-hidden="true" />
          </button>
        </header>
        <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">{children}</div>
      </aside>
    </div>
  );
}

function useMedia(query) {
  const [matches, setMatches] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}

const shared = { title: PropTypes.string.isRequired, onClose: PropTypes.func.isRequired, closing: PropTypes.bool, onClosed: PropTypes.func, reduced: PropTypes.bool, children: PropTypes.node };
BottomSheet.propTypes = shared;
SidePanel.propTypes = shared;
Sheet.propTypes = { open: PropTypes.bool.isRequired, onClose: PropTypes.func.isRequired, title: PropTypes.string.isRequired, children: PropTypes.node };
