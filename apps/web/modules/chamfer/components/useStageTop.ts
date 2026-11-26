import { useEffect, useRef } from 'react';

/**
 * A new screen starts at its top. Without this the next step opens wherever
 * the previous one was scrolled to — after a long form that is mid-letter,
 * with its heading above the viewport, under the fixed site header.
 * Never scrolls on first render, and never when the top is already in view.
 */
export const useStageTop = (key: unknown) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const seen = useRef<unknown>(key);
  useEffect(() => {
    if (Object.is(seen.current, key)) return;
    seen.current = key;
    const el = ref.current;
    if (!el || typeof el.getBoundingClientRect !== 'function') return;
    if (el.getBoundingClientRect().top >= 64) return;
    el.scrollIntoView({ block: 'start', behavior: 'instant' as ScrollBehavior });
  }, [key]);
  return ref;
};
