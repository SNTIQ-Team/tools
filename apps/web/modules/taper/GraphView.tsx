'use client';

/**
 * Force-directed 2D canvas graph of the authority network.
 *
 * Starts from the place's resolved authorities (+ their supervisory
 * bodies); clicking a node expands it live via /authorities/{id} —
 * the graph grows as you explore. Pure canvas, no graph library:
 * O(n²) repulsion is fine for the few hundred nodes a session reaches.
 * Drag nodes, drag the background to pan, wheel to zoom.
 */

import React, { useEffect, useRef } from 'react';
import { agDetail } from './client';
import { HUES, nodeHex, nodeHue } from './graphStyle';

export interface SeedNode {
  id: number;
  name: string;
  kind: string;
}
export interface SeedLink {
  a: number;
  b: number;
  rel: string;
}

interface N {
  id: number; name: string; kind: string;
  x: number; y: number; vx: number; vy: number;
  expanded: boolean;
}
interface L { a: number; b: number; rel: string }

/** Same three hues as the constellation and its legend (see graphStyle). */
export const GRAPH_LEGEND = HUES;

const GraphView: React.FC<{
  seeds: SeedNode[];
  seedLinks: SeedLink[];
  height?: number;
  /** double-click on a node — open its detail drawer */
  onInspect?: (id: number) => void;
}> = ({ seeds, seedLinks, height = 520, onInspect }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const state = useRef<{
    nodes: N[]; links: L[]; cam: { x: number; y: number; z: number };
    hover: N | null; drag: N | null; panning: boolean;
    last: { x: number; y: number };
  }>({ nodes: [], links: [], cam: { x: 0, y: 0, z: 1 }, hover: null,
       drag: null, panning: false, last: { x: 0, y: 0 } });

  // (re)seed when inputs change
  useEffect(() => {
    const st = state.current;
    st.nodes = seeds.map((s, i) => ({
      ...s,
      x: Math.cos((i / Math.max(1, seeds.length)) * Math.PI * 2) * 140,
      y: Math.sin((i / Math.max(1, seeds.length)) * Math.PI * 2) * 140,
      vx: 0, vy: 0, expanded: false,
    }));
    st.links = seedLinks.filter(
      (l) => st.nodes.some((n) => n.id === l.a) &&
             st.nodes.some((n) => n.id === l.b));
    st.cam = { x: 0, y: 0, z: 1 };
  }, [seeds, seedLinks]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const st = state.current;
    let raf = 0;
    let disposed = false;

    // page tokens, so the canvas follows the theme like the rest of the page
    const css = getComputedStyle(canvas);
    const dark = document.documentElement.classList.contains('dark');
    const ink = css.getPropertyValue('--c-text-main').trim() || '#111111';
    const muted = css.getPropertyValue('--c-text-muted').trim() || '#64748b';
    const surface = css.getPropertyValue('--panel-bg').trim() || '#ffffff';
    const family = css.fontFamily || 'sans-serif';
    const colorFor = (kind: string) => nodeHex(nodeHue(kind), dark) ?? muted;

    const dpr = window.devicePixelRatio || 1;
    const resize = () => {
      const w = canvas.clientWidth;
      canvas.width = w * dpr;
      canvas.height = height * dpr;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const toWorld = (px: number, py: number) => {
      const r = canvas.getBoundingClientRect();
      const cx = canvas.width / dpr / 2;
      const cy = height / 2;
      return {
        x: (px - r.left - cx) / st.cam.z + st.cam.x,
        y: (py - r.top - cy) / st.cam.z + st.cam.y,
      };
    };
    const nodeAt = (wx: number, wy: number): N | null => {
      for (let i = st.nodes.length - 1; i >= 0; i--) {
        const n = st.nodes[i];
        const d2 = (n.x - wx) ** 2 + (n.y - wy) ** 2;
        if (d2 < (10 / st.cam.z + 6) ** 2) return n;
      }
      return null;
    };

    const expand = async (n: N) => {
      if (n.expanded) return;
      n.expanded = true;
      try {
        const d = await agDetail(n.id);
        if (disposed) return;
        for (const e of d.related) {
          let target = st.nodes.find((x) => x.id === e.id);
          if (!target) {
            const ang = Math.random() * Math.PI * 2;
            target = { id: e.id, name: e.name, kind: e.kind,
                       x: n.x + Math.cos(ang) * 70,
                       y: n.y + Math.sin(ang) * 70,
                       vx: 0, vy: 0, expanded: false };
            st.nodes.push(target);
          }
          if (!st.links.some((l) =>
              (l.a === n.id && l.b === e.id) ||
              (l.a === e.id && l.b === n.id))) {
            st.links.push({ a: n.id, b: e.id, rel: e.relation });
          }
        }
      } catch { /* node stays collapsed-looking */ }
    };

    // ----------------------------------------------------- input
    const onDown = (ev: PointerEvent) => {
      const w = toWorld(ev.clientX, ev.clientY);
      const n = nodeAt(w.x, w.y);
      st.last = { x: ev.clientX, y: ev.clientY };
      if (n) st.drag = n;
      else st.panning = true;
      canvas.setPointerCapture(ev.pointerId);
    };
    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - st.last.x;
      const dy = ev.clientY - st.last.y;
      st.last = { x: ev.clientX, y: ev.clientY };
      if (st.drag) {
        st.drag.x += dx / st.cam.z;
        st.drag.y += dy / st.cam.z;
        st.drag.vx = st.drag.vy = 0;
      } else if (st.panning) {
        st.cam.x -= dx / st.cam.z;
        st.cam.y -= dy / st.cam.z;
      } else {
        const w = toWorld(ev.clientX, ev.clientY);
        st.hover = nodeAt(w.x, w.y);
      }
    };
    const onUp = (ev: PointerEvent) => {
      if (st.drag && Math.abs(ev.clientX - st.last.x) < 3) {
        void expand(st.drag);
      }
      st.drag = null;
      st.panning = false;
    };
    const onWheel = (ev: WheelEvent) => {
      ev.preventDefault();
      const f = ev.deltaY < 0 ? 1.12 : 0.89;
      st.cam.z = Math.min(4, Math.max(0.25, st.cam.z * f));
    };
    const onDbl = (ev: MouseEvent) => {
      const w = toWorld(ev.clientX, ev.clientY);
      const n = nodeAt(w.x, w.y);
      if (n && onInspect) onInspect(n.id);
    };
    canvas.addEventListener('dblclick', onDbl);
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });

    // ------------------------------------------------ physics+draw
    const tick = () => {
      const { nodes, links } = st;
      // repulsion
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i], b = nodes[j];
          let dx = b.x - a.x, dy = b.y - a.y;
          let d2 = dx * dx + dy * dy;
          if (d2 < 1) { dx = Math.random() - 0.5; dy = Math.random() - 0.5; d2 = 1; }
          const f = 1800 / d2;
          const d = Math.sqrt(d2);
          const fx = (dx / d) * f, fy = (dy / d) * f;
          a.vx -= fx; a.vy -= fy; b.vx += fx; b.vy += fy;
        }
      }
      // springs
      for (const l of links) {
        const a = nodes.find((n) => n.id === l.a);
        const b = nodes.find((n) => n.id === l.b);
        if (!a || !b) continue;
        const dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.max(1, Math.hypot(dx, dy));
        const f = (d - 110) * 0.004;
        const fx = (dx / d) * f, fy = (dy / d) * f;
        a.vx += fx; a.vy += fy; b.vx -= fx; b.vy -= fy;
      }
      for (const n of nodes) {
        n.vx = (n.vx - n.x * 0.0006) * 0.85;
        n.vy = (n.vy - n.y * 0.0006) * 0.85;
        if (n !== st.drag) { n.x += n.vx; n.y += n.vy; }
      }

      // draw
      const w = canvas.width / dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, height);
      ctx.save();
      ctx.translate(w / 2, height / 2);
      ctx.scale(st.cam.z, st.cam.z);
      ctx.translate(-st.cam.x, -st.cam.y);

      ctx.lineWidth = 1 / st.cam.z;
      for (const l of links) {
        const a = nodes.find((n) => n.id === l.a);
        const b = nodes.find((n) => n.id === l.b);
        if (!a || !b) continue;
        ctx.strokeStyle = l.rel === 'supervision'
          ? HUES.oversight[dark ? 'dark' : 'light'] : muted;
        ctx.globalAlpha = l.rel === 'supervision' ? 0.9 : 0.5;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      for (const n of nodes) {
        const r = n === st.hover ? 9 : 7;
        const col = colorFor(n.kind);
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
        ctx.fill();
        if (!n.expanded) {
          ctx.fillStyle = surface;
          ctx.font = `600 ${10 / st.cam.z}px ${family}`;
          ctx.fillText('+', n.x - 3 / st.cam.z, n.y + 3.5 / st.cam.z);
        }
        if (st.cam.z > 0.7 || n === st.hover) {
          ctx.fillStyle = n === st.hover ? ink : muted;
          ctx.font = `${n === st.hover ? 600 : 400} ${12 / st.cam.z}px ${family}`;
          ctx.fillText(
            n.name.length > 46 ? n.name.slice(0, 45) + '…' : n.name,
            n.x + 12 / st.cam.z, n.y + 4 / st.cam.z);
        }
      }
      ctx.restore();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener('dblclick', onDbl);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('wheel', onWheel);
    };
  }, [height, onInspect]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full rounded-xl border border-[var(--panel-border)] bg-[var(--panel-bg)] cursor-grab active:cursor-grabbing touch-none"
      style={{ height }}
    />
  );
};

export default GraphView;
