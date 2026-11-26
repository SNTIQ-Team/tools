'use client';

/**
 * Real full screen for the composed letter and the e-mail draft.
 *
 * The previous "full screen" was a translucent modal inset by `pt-14 sm:p-4`,
 * so the document never actually filled the viewport and there was no way out
 * except hitting the small toolbar button again. This covers the viewport
 * edge to edge on an opaque background and offers every exit people reach for:
 *
 *   - Esc                       (desktop)
 *   - the browser/system Back   (Android, and the back gesture on iOS Safari)
 *   - swipe down from the top   (touch, only while scrolled to the top so it
 *                                never fights the document's own scrolling)
 *   - the close button          (always visible, one thumb-reach away)
 *
 * Back works because opening pushes one history entry; closing by any other
 * route pops it again, so the overlay never leaves a dead entry behind.
 *
 * It renders through a PORTAL to <body>, and that is load-bearing rather than
 * tidiness: any transformed ancestor becomes the containing block for
 * `position: fixed`, and an in-place overlay would then cover only that box —
 * which is exactly why "full screen" was never full screen. The portal also
 * puts the sheet (z-index 200, see .sheet) above the fixed header at z-[100].
 * Being outside the module root, it is styled by its own classes only.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import s from '../chamfer.module.css';

type Props = {
  open: boolean;
  onClose: () => void;
  label: string;
  closeLabel: string;
  hint?: string;
  children: React.ReactNode;
};

/** Drag far enough that it cannot be mistaken for a scroll nudge. */
const SWIPE_CLOSE_PX = 96;

const FullscreenOverlay: React.FC<Props> = ({
  open, onClose, label, closeLabel, hint, children,
}) => {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const dragStart = useRef<number | null>(null);
  // Set while WE pop our own entry, so the popstate handler doesn't close twice.
  const closingViaHistory = useRef(false);
  const pushedEntry = useRef(false);
  const [drag, setDrag] = useState(0);

  // Callers pass an inline arrow (`() => setFull(false)`), so `onClose` has a
  // new identity every render. Keeping it in a ref lets the setup effect below
  // depend on `open` alone — depending on the callback would re-run it on each
  // render and push a fresh history entry every time.
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  /** The single exit path: unwind our history entry, then let popstate close. */
  const requestClose = useCallback(() => {
    if (pushedEntry.current && !closingViaHistory.current) {
      closingViaHistory.current = true;
      window.history.back();          // -> popstate -> onClose
      return;
    }
    onCloseRef.current();
  }, []);

  // Escape, Back, and body scroll lock all live and die with `open`.
  useEffect(() => {
    if (!open) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const { body } = document;
    const priorOverflow = body.style.overflow;
    body.style.overflow = 'hidden';

    window.history.pushState({ sntiqFullscreen: true }, '');
    pushedEntry.current = true;
    closingViaHistory.current = false;

    const onPop = () => {
      // Our entry is already gone by the time this fires.
      pushedEntry.current = false;
      closingViaHistory.current = false;
      onCloseRef.current();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      requestClose();
    };

    window.addEventListener('popstate', onPop);
    // Capture phase: the module shell also listens for Escape, and full screen
    // is the innermost layer, so it must consume the key first.
    window.addEventListener('keydown', onKey, true);
    panelRef.current?.focus({ preventScroll: true });

    return () => {
      window.removeEventListener('popstate', onPop);
      window.removeEventListener('keydown', onKey, true);
      body.style.overflow = priorOverflow;
      setDrag(0);
      dragStart.current = null;
      // Opened, then unmounted without a pop (e.g. navigation): drop the entry.
      if (pushedEntry.current && !closingViaHistory.current) {
        pushedEntry.current = false;
        window.history.back();
      }
      previouslyFocused?.focus?.({ preventScroll: true });
    };
  }, [open, requestClose]);

  if (!open) return null;

  const onTouchStart = (event: React.TouchEvent) => {
    // Only arm the gesture at the very top, so mid-document drags still scroll.
    dragStart.current = (scrollRef.current?.scrollTop ?? 0) <= 0
      ? event.touches[0].clientY
      : null;
  };
  const onTouchMove = (event: React.TouchEvent) => {
    if (dragStart.current == null) return;
    const delta = event.touches[0].clientY - dragStart.current;
    setDrag(delta > 0 ? delta : 0);
  };
  const onTouchEnd = () => {
    if (drag > SWIPE_CLOSE_PX) requestClose();
    dragStart.current = null;
    setDrag(0);
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-label={label}
      tabIndex={-1}
      className={s.sheet}
      style={drag ? { transform: `translateY(${Math.min(drag, 160)}px)` } : undefined}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
    >
      {/* Grab handle: the affordance that tells touch users the sheet is
          draggable. Decorative — the close button is the accessible control. */}
      <div aria-hidden="true" className={s.sheetGrip}>
        <span></span>
      </div>

      <div className={s.sheetBar}>
        <b>{label}</b>
        <div>
          {hint && <span className={`${s.small} hidden sm:inline`}>{hint}</span>}
          <button
            type="button"
            onClick={requestClose}
            aria-label={closeLabel}
            title={closeLabel}
            className={s.iconBtn}
          >
            <X aria-hidden="true" />
          </button>
        </div>
      </div>

      <div ref={scrollRef} className={s.sheetBody}>
        {children}
      </div>
    </div>,
    document.body,
  );
};

export default FullscreenOverlay;
