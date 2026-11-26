'use client';

import React, { useEffect, useSyncExternalStore } from 'react';
import Relief, { useReliefMotion } from './home/Relief';
import type { ReliefName } from './home/relief';
import s from './nightBand.module.css';

/** The html classes set by the pre-paint script and ThemeProvider decide what
    the band may show: high contrast shows no surface, reduced motion a still
    picture, otherwise the live relief. */
type Mode = 'server' | 'contrast' | 'reduced' | 'motion';
function subscribeMode(fn: () => void) {
  const mo = new MutationObserver(fn);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  return () => mo.disconnect();
}
const readMode = (): Mode => {
  const c = document.documentElement.classList;
  return c.contains('high-contrast') ? 'contrast' : c.contains('reduce-motion') ? 'reduced' : 'motion';
};
// Server and hydration render: no surface yet, so nothing starts that the
// first client pass would have to tear down again.
const serverMode = (): Mode => 'server';

/**
 * A dark band at the top of a page with the relief behind its content: the
 * title of a text page (size `page`), the head of a module (`module`), the
 * strip above a workspace (`workspace`). Night in either theme; the header
 * over it reads light until the page scrolls (the routes that open on a band
 * are listed in nightTop.ts).
 *
 * `anyRoute` is for the error views, which render on whatever route failed
 * (a page that is not listed in nightTop.ts, a module): the mark then says
 * "any" and the stylesheet lets the header read light over the band no matter
 * the route (see the header rules in globals.css).
 *
 * The relief runs only when motion is allowed and the device can carry it.
 * Under reduced motion, or once the relief has given up on this device, a
 * still picture of the same surface stands in. High contrast drops both and
 * turns the band into plain page ground with a rule under it.
 */
const NightBand: React.FC<{
  preset: ReliefName;
  size: 'page' | 'module' | 'workspace';
  anyRoute?: boolean;
  /** A module band folded to a strip while the visitor works (ModuleBand). */
  compact?: boolean;
  /** Full width instead of the centred page column: a workspace whose rail
      and panes run edge to edge, under the workspace header. */
  wide?: boolean;
  children: React.ReactNode;
}> = ({ preset, size, anyRoute, compact, wide, children }) => {
  const { still } = useReliefMotion();
  const mode = useSyncExternalStore(subscribeMode, readMode, serverMode);
  const live = mode === 'motion' && !still;
  const picture = (mode === 'motion' && still) || mode === 'reduced';

  // A device without the live relief also runs the header without its blur.
  useEffect(() => {
    if (!still) return;
    document.documentElement.dataset.lite = 'true';
    return () => { delete document.documentElement.dataset.lite; };
  }, [still]);

  return (
    <div className={s.band} data-size={size} data-preset={preset} data-compact={compact ? 'true' : undefined} data-night-top={anyRoute ? 'any' : undefined}>
      {picture && (
        <div
          className={s.still}
          style={{ backgroundImage: `url(/assets/img/relief/${preset}.webp)` }}
          aria-hidden="true"
        />
      )}
      {live && <Relief preset={preset} surface={size === 'page' ? 'stage' : 'band'} className={s.gl} />}
      <div className={`${s.body} px-4 sm:px-6 lg:px-8`}>
        <div className={wide ? undefined : 'max-w-screen-xl mx-auto'}>{children}</div>
      </div>
    </div>
  );
};

export default NightBand;
