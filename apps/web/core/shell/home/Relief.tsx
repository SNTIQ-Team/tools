'use client';

import React, { useEffect, useRef, useSyncExternalStore } from 'react';
import { createRelief, reliefStore, reliefUnavailable, setReliefPlaying, type ReliefHandle, type ReliefName, type ReliefSurface } from './relief';

interface ReliefProps {
  preset: ReliefName;
  surface?: ReliefSurface;
  className?: string;
  /** Engage the rapid-switch Voronoi/Simplex mineral scrub field while true. */
  scrub?: boolean;
  /** Monotonic click counter that sends a subtle radial impulse across the Voronoi seams. */
  scrubPulse?: number;
}

/** Canvas with the relief. */
const Relief: React.FC<ReliefProps> = ({ preset, surface = 'stage', className, scrub = false, scrubPulse = 0 }) => {
  const canvas = useRef<HTMLCanvasElement>(null);
  const handle = useRef<ReliefHandle | null>(null);
  const first = useRef(preset);

  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const start = () => {
      handle.current = createRelief(el, first.current, { surface });
      if (!handle.current) reliefUnavailable();
    };
    // On the next frame: late enough not to block hydration, early enough that
    // the surface is coming up while the headline is still forming.
    const id = window.requestAnimationFrame(start);
    return () => {
      window.cancelAnimationFrame(id);
      handle.current?.destroy();
      handle.current = null;
    };
  }, [surface]);

  useEffect(() => {
    first.current = preset;
    handle.current?.set(preset);
  }, [preset]);

  useEffect(() => {
    handle.current?.setScrub(scrub, preset, scrubPulse);
  }, [scrub, preset, scrubPulse]);

  return <canvas ref={canvas} className={className} aria-hidden="true" />;
};

export default Relief;

/** Whether the relief is moving, and whether there is one at all (WebGL2 present). */
export function useReliefMotion() {
  const playing = useSyncExternalStore(reliefStore.subscribe, reliefStore.playing, () => true);
  const supported = useSyncExternalStore(reliefStore.subscribe, reliefStore.supported, () => false);
  const still = useSyncExternalStore(reliefStore.subscribe, reliefStore.still, () => false);
  return { playing, supported, still, setPlaying: setReliefPlaying };
}
