'use client';

/**
 * Authority constellation — progressive-disclosure graph.
 *
 * Start state: two independent domains, Europäische Union and Deutschland.
 * The internal workspace root is never rendered and carries no legal meaning.
 * Deutschland then unfolds into Bund + the 16 Länder; EU institutions unfold
 * in their own space. Children occupy deterministic rings, so opening a branch
 * never reshuffles an unrelated one.
 *
 * 2.5D focus/context: while hovering, unrelated nodes dim and drop
 * back; the active branch keeps its full ink. Child
 * counts ride on the nodes (+N) as the discoverability cue.
 * Secondary relations default to focus/context disclosure. The user can still
 * reveal all recorded relations, but the ordinary view avoids a line hairball.
 *
 * Search is universal: place lookup goes through /places (server-side
 * typo tolerance + PLZ, same engine as Chamfer), authority names
 * are matched locally; picking either unfolds the path to it.
 */

import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Loader2, Minus, Plus, Search, Focus,
} from 'lucide-react';
import { taperUrl } from '../../core/config';
import {
  relationIsDirected,
  EU_DOMAIN, GERMANY_DOMAIN, WORKSPACE_ROOT,
  type Built, type ONode,
} from './omnitree';
import { loadOmnigram } from './omnitree.client';
import {
  COURT_THREAD, LineMark, NodeMark, REL_LINES, lineHex, nodeHex, nodeHue,
  nodeShape, type LineHue,
} from './graphStyle';
import './i18n/register';

/** Länder placed roughly like on the map of Germany (unit coords). */
const GEO: Record<number, [number, number]> = {
  [-1]: [0.02, -0.95], [-2]: [0.10, -0.70], [-13]: [0.55, -0.82],
  [-4]: [-0.18, -0.60], [-3]: [-0.18, -0.38], [-12]: [0.62, -0.40],
  [-11]: [0.70, -0.28], [-15]: [0.32, -0.26], [-5]: [-0.65, -0.12],
  [-6]: [-0.30, 0.12], [-16]: [0.12, 0.08], [-14]: [0.58, 0.05],
  [-7]: [-0.64, 0.38], [-10]: [-0.70, 0.64], [-8]: [-0.26, 0.80],
  [-9]: [0.30, 0.74], [-900]: [-0.72, -0.92],
};
const GEO_SCALE = 260;
const DOMAIN_X = 190;
const DEFAULT_CAMERA: { x: number; y: number; z: number } =
  { x: 0, y: 0, z: 1.05 };

/** Keep both independent entry domains visible on narrow canvases too. */
const overviewCamera = (width: number) => ({
  x: DEFAULT_CAMERA.x,
  y: DEFAULT_CAMERA.y,
  z: Math.min(
    DEFAULT_CAMERA.z,
    Math.max(0.38, (Math.max(width, 1) - 104) / (DOMAIN_X * 2)),
  ),
});

interface VNode extends ONode {
  tx: number; ty: number;
}

const nodeRadius = (v: ONode, focused = false) => {
  const base = v.id === WORKSPACE_ROOT ? 0
    : v.id === EU_DOMAIN || v.id === GERMANY_DOMAIN ? 15
      : v.virtual ? 9.5
    : Math.max(3.6, 6.5 - v.depth * 0.5);
  return focused ? base * 1.5 : base;
};

const stableUnit = (id: number) => {
  // Deterministic fallback; Math.random() here made positions jump whenever
  // React remounted the canvas.
  let x = Math.imul(id ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13;
  return ((x >>> 0) % 10_000) / 10_000;
};

interface ScreenRect { x: number; y: number; w: number; h: number }
const overlaps = (a: ScreenRect, b: ScreenRect) =>
  a.x < b.x + b.w && a.x + a.w > b.x &&
  a.y < b.y + b.h && a.y + a.h > b.y;

interface PlaceHit {
  ags: string; name: string; land: string; plz?: string;
}

/**
 * Canvas height. 560px on a desk; on a phone a canvas of that height that
 * swallows every touch is a scroll trap, so it stays roughly square and never
 * taller than about two thirds of the screen. Driven by the WIDTH only after
 * mount: the mobile URL bar changes the viewport height on every scroll.
 */
const fitHeight = (max: number) => {
  if (typeof window === 'undefined') return max;
  const byViewport = Math.max(320, Math.round(window.innerHeight * 0.68));
  const byWidth = window.innerWidth < 640
    ? Math.max(340, Math.round(window.innerWidth * 1.05)) : max;
  return Math.min(max, byViewport, byWidth);
};

/** Everything the canvas borrows from the page: tokens, font, text scale. */
interface Paint {
  dark: boolean; contrast: boolean;
  surface: string; ink: string; muted: string; link: string;
  font: string; scale: number;
}
const readPaint = (el: HTMLElement): Paint => {
  const cs = getComputedStyle(el);
  const token = (name: string, fallback: string) =>
    cs.getPropertyValue(name).trim() || fallback;
  const root = document.documentElement;
  return {
    dark: root.classList.contains('dark'),
    contrast: document.body.classList.contains('high-contrast'),
    surface: token('--panel-bg', '#ffffff'),
    ink: token('--c-text-main', '#111111'),
    muted: token('--c-text-muted', '#64748b'),
    link: token('--c-link', '#0033a0'),
    font: cs.fontFamily || 'sans-serif',
    // large-text mode enlarges the root font; canvas labels follow it
    scale: (parseFloat(getComputedStyle(root).fontSize) || 16) / 16,
  };
};

const LEGEND_NODES: [string, boolean, string][] = [
  ['sonstige', false, 'legend.deAuthority'],
  ['amtsgericht', false, 'legend.deCourt'],
  ['eu_institution', false, 'legend.euInstitution'],
  ['eu_court', false, 'legend.euCourt'],
  ['land', true, 'legend.layoutHub'],
];
/** relation, label key, drawn with an arrowhead */
const LEGEND_LINES: [string, string, boolean][] = [
  ['parent', 'legend.structural', false],
  ['appeal', 'legend.appeal', true],
  ['judicial_review', 'legend.judicialReview', true],
  ['supervision', 'rel.supervision', true],
  ['sectoral_oversight', 'legend.sectoral', true],
  ['financial_audit', 'legend.audit', true],
  ['maladministration_review', 'legend.maladministration', true],
  ['political_accountability', 'legend.accountability', true],
  ['co_legislation', 'legend.coLegislation', false],
  ['successor', 'rel.successor', true],
];

const arrowHead = (
  ctx: CanvasRenderingContext2D,
  controlX: number, controlY: number,
  targetX: number, targetY: number,
  targetRadius: number, zoom: number, color: string,
) => {
  const angle = Math.atan2(targetY - controlY, targetX - controlX);
  const size = 5.5 / zoom;
  // Stop at the node perimeter. Arrowheads drawn into the centre disappear
  // under the node layer at ordinary zoom levels.
  const tipX = targetX - Math.cos(angle) * (targetRadius + 1.5 / zoom);
  const tipY = targetY - Math.sin(angle) * (targetRadius + 1.5 / zoom);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(tipX, tipY);
  ctx.lineTo(tipX - Math.cos(angle - 0.55) * size,
             tipY - Math.sin(angle - 0.55) * size);
  ctx.lineTo(tipX - Math.cos(angle + 0.55) * size,
             tipY - Math.sin(angle + 0.55) * size);
  ctx.closePath();
  ctx.fill();
};

const GermanyGraph: React.FC<{
  onInspect: (id: number) => void;
  focusIds?: number[];
  /** extra dotted threads, e.g. place authorities -> competent court */
  focusLinks?: [number, number][];
  localView?: boolean;
  height?: number;
}> = ({ onInspect, focusIds, focusLinks, localView, height: maxHeight = 560 }) => {
  const { t } = useTranslation('taper');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [height, setHeight] = useState(() => fitHeight(maxHeight));
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState('');
  const [placeHits, setPlaceHits] = useState<PlaceHit[]>([]);
  const [authHits, setAuthHits] = useState<ONode[]>([]);
  const [hoverInfo, setHoverInfo] = useState<ONode | null>(null);
  const [allRelations, setAllRelations] = useState(false);

  const built = useRef<Built | null>(null);
  const vn = useRef<Map<number, VNode>>(new Map());
  const expanded = useRef<Set<number>>(new Set([WORKSPACE_ROOT]));
  const cam = useRef({ ...DEFAULT_CAMERA });
  const target = useRef<{ x: number; y: number; z: number } | null>(null);
  const hover = useRef<VNode | null>(null);
  const focus = useRef<Set<number>>(new Set());
  const fLinks = useRef<[number, number][]>([]);
  const relationsAll = useRef(false);
  const dirty = useRef(true);
  const paint = useRef<Paint | null>(null);
  const settling = useRef(0);
  const wake = useRef<() => void>(() => {});
  const inspect = useRef(onInspect);

  // Opening and closing the inspector changes parent UI state. Keep the
  // latest callback without rebuilding the canvas interaction effect: a
  // rebuild used to run its first-measure branch again and snap the camera
  // toward the overview before the user's first pan.
  useEffect(() => { inspect.current = onInspect; }, [onInspect]);

  const invalidate = () => {
    dirty.current = true;
    wake.current();
  };

  // Refit the canvas when the width changes (rotation, window resize).
  useEffect(() => {
    let lastWidth = window.innerWidth;
    const onResize = () => {
      if (window.innerWidth === lastWidth) return;
      lastWidth = window.innerWidth;
      setHeight(fitHeight(maxHeight));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [maxHeight]);

  // The canvas paints with the page's tokens: repaint when the theme, the
  // contrast mode or the text size is switched.
  useEffect(() => {
    const repaint = () => { paint.current = null; invalidate(); };
    const mo = new MutationObserver(repaint);
    mo.observe(document.documentElement,
               { attributes: true, attributeFilter: ['class'] });
    mo.observe(document.body,
               { attributes: true, attributeFilter: ['class'] });
    // webfonts arriving late would otherwise leave fallback-measured labels
    document.fonts?.ready.then(repaint).catch(() => {});
    return () => mo.disconnect();
  }, []);

  // ------------------------------------------------------ visibility
  const childIds = (id: number) =>
    built.current?.childrenOf.get(id) ?? [];

  const ensureVNode = (n: ONode, px: number, py: number): VNode => {
    let v = vn.current.get(n.id);
    if (!v) {
      v = { ...n, x: px, y: py, tx: px, ty: py };
      vn.current.set(n.id, v);
    }
    return v;
  };

  /** recompute fan targets for the children of `id` */
  const layoutChildren = (id: number) => {
    const b = built.current;
    if (!b) return;
    const p = vn.current.get(id);
    if (!p) return;
    const kids = childIds(id);
    if (kids.length === 0) return;
    if (id === WORKSPACE_ROOT) {
      // The workspace itself is invisible. Its children are independent
      // domains, deliberately not nodes in one legal or supervisory ladder.
      for (const k of kids) {
        const n = b.byId.get(k);
        if (!n) continue;
        const x = k === EU_DOMAIN ? -DOMAIN_X
          : k === GERMANY_DOMAIN ? DOMAIN_X
            : (stableUnit(k) - 0.5) * DOMAIN_X * 2;
        const v = ensureVNode(n, 0, 0);
        v.tx = x;
        v.ty = 0;
      }
      return;
    }
    if (id === GERMANY_DOMAIN) {
      // Bund and Länder belong to the German domain; geography is merely a
      // stable orientation aid inside that domain.
      for (const k of kids) {
        const n = b.byId.get(k);
        if (!n) continue;
        const g = GEO[k] ?? [stableUnit(k) - 0.5,
                             stableUnit(k * 31) - 0.5];
        const v = ensureVNode(n, p.tx, p.ty);
        v.tx = p.tx + g[0] * GEO_SCALE;
        v.ty = p.ty + g[1] * GEO_SCALE;
      }
      return;
    }
    const up = b.upOf.get(id);
    const pu = up != null ? vn.current.get(up) : null;
    const base = pu
      ? Math.atan2(p.ty - pu.ty, p.tx - pu.tx)
      : Math.atan2(p.ty, p.tx);
    // category-sorted fan with small gaps between kind groups —
    // big hubs read as labelled clusters instead of one long arc
    const cat = (k: number) => {
      const c = b.byId.get(k);
      if (!c) return 'zz';
      if (c.virtual) return '0v';
      return c.kind;
    };
    const sorted = [...kids].sort((ka, kb) =>
      cat(ka).localeCompare(cat(kb)) ||
      (b.byId.get(ka)?.name ?? '').localeCompare(
        b.byId.get(kb)?.name ?? ''));
    // Pack large child sets into deterministic concentric arcs. Every ring
    // has a minimum screen-space separation, avoiding the old fan pile-up.
    let offset = 0;
    let ring = 0;
    while (offset < sorted.length) {
      const radius = 112 + ring * 76;
      const capacity = Math.max(10, Math.floor((Math.PI * 1.55 * radius) / 48));
      const count = Math.min(capacity, sorted.length - offset);
      const spread = count === 1 ? 0 : Math.min(
        Math.PI * 1.55, 0.24 * (count - 1) + 0.65);
      for (let i = 0; i < count; i++) {
        const k = sorted[offset + i];
        const node = b.byId.get(k);
        if (!node) continue;
        const phase = ring % 2 ? 0.5 / Math.max(count, 1) : 0;
        const unit = count === 1 ? 0.5
          : Math.min(1, i / (count - 1) + phase);
        const a = base + (unit - 0.5) * spread;
        const v = ensureVNode(node, p.tx, p.ty);
        v.tx = p.tx + Math.cos(a) * radius;
        v.ty = p.ty + Math.sin(a) * radius;
      }
      offset += count;
      ring++;
    }
  };

  const visibleIds = (): Set<number> => {
    const vis = new Set<number>([0]);
    const stack = [0];
    while (stack.length) {
      const id = stack.pop()!;
      if (!expanded.current.has(id)) continue;
      for (const c of childIds(id)) {
        vis.add(c);
        stack.push(c);
      }
    }
    return vis;
  };

  const expand = (id: number) => {
    expanded.current.add(id);
    layoutChildren(id);
    settling.current = 34;
    invalidate();
  };
  const collapse = (id: number) => {
    const stack = [id];
    while (stack.length) {
      const v = stack.pop()!;
      expanded.current.delete(v);
      for (const c of childIds(v)) stack.push(c);
    }
    if (id === WORKSPACE_ROOT) expanded.current.add(WORKSPACE_ROOT);
    settling.current = 24;
    invalidate();
  };

  const expandPathTo = (id: number, fly = true) => {
    const b = built.current;
    if (!b) return;
    const path: number[] = [];
    let cur: number | undefined = b.upOf.get(id);
    while (cur != null) {
      path.push(cur);
      if (cur === WORKSPACE_ROOT) break;
      cur = b.upOf.get(cur);
    }
    for (const p of path.reverse()) expand(p);
    const v = vn.current.get(id);
    if (v && fly) target.current = { x: v.tx, y: v.ty, z: 1.6 };
    invalidate();
  };

  // -------------------------------------------------------- data load
  useEffect(() => {
    let dead = false;
    loadOmnigram()
      .then((graph) => {
        if (dead) return;
        setFailed(false);
        built.current = graph;
        const root = built.current.byId.get(WORKSPACE_ROOT)!;
        ensureVNode(root, 0, 0);
        layoutChildren(WORKSPACE_ROOT);
        settling.current = 34;
        setLoading(false);
        if (focusIds?.length) {
          focus.current = new Set(focusIds);
          for (const f of focusIds.slice(0, 8)) expandPathTo(f, false);
          const v = vn.current.get(focusIds[0]);
          if (v) target.current = { x: v.tx, y: v.ty, z: 1.2 };
        }
        invalidate();
      })
      .catch(() => {
        if (dead) return;
        // an empty canvas with no word of explanation looked like a crash
        setFailed(true);
        setLoading(false);
      });
    return () => { dead = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  useEffect(() => {
    fLinks.current = focusLinks ?? [];
    invalidate();
  }, [focusLinks]);

  useEffect(() => {
    focus.current = new Set(focusIds ?? []);
    if (built.current && focusIds?.length) {
      for (const f of focusIds.slice(0, 8)) expandPathTo(f, false);
      const v = vn.current.get(focusIds[0]);
      if (v) target.current = { x: v.tx, y: v.ty, z: 1.2 };
    }
    invalidate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusIds, localView]);

  // ------------------------------------------------- universal search
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) { setPlaceHits([]); setAuthHits([]); return; }
    const ctl = new AbortController();
    const tid = setTimeout(() => {
      fetch(taperUrl(`/places?q=${encodeURIComponent(q)}&limit=4`),
            { signal: ctl.signal })
        .then((r) => r.json())
        .then((r: { matches: PlaceHit[] }) => setPlaceHits(r.matches))
        .catch(() => {});
    }, 250);
    const b = built.current;
    if (b) {
      const lq = q.toLocaleLowerCase();
      const aliases = (n: ONode) => {
        if (!n.kind.startsWith('eu_')) return '';
        const name = n.name.toLocaleLowerCase();
        const base = ' eu european europa europäische union ес єс ' +
          'institution organ body институт орган інституція';
        if (name.includes('gerichtshof der europäischen union')) {
          return `${base} cjeu eugh eu court judicial суд суд єс`;
        }
        if (name === 'gerichtshof') {
          return `${base} ecj eugh court of justice суд`;
        }
        if (name.includes('gericht der europäischen union')) {
          return `${base} general court eu tribunal общий суд загальний суд`;
        }
        if (name.includes('europäische zentralbank')) {
          return `${base} ecb ezb central bank центральный банк центральний банк`;
        }
        if (name.includes('datenschutzbeauftrag')) {
          return `${base} edps eudsb data protection privacy Datenschutz ` +
            'защита данных захист даних';
        }
        if (name.includes('rechnungshof')) {
          return `${base} eca european court auditors audit аудит Rechnung`;
        }
        if (name.includes('kommission')) {
          return `${base} ec commission комиссия комісія kommission`;
        }
        if (name.includes('parlament')) {
          return `${base} ep parliament парламент parlament`;
        }
        if (name.includes('europäischer rat')) {
          return `${base} euco european council европейский совет ` +
            'європейська рада';
        }
        if (name.includes('rat der europäischen union')) {
          return `${base} consil council of the eu совет ес рада єс`;
        }
        if (name.includes('bürgerbeauftrag')) {
          return `${base} eo ombudsman омбудсмен уповноважена complaints`;
        }
        return base;
      };
      setAuthHits(b.nodes
        .filter((n) => !n.virtual &&
          `${n.searchText}${aliases(n)}`.includes(lq))
        .sort((a, c) => {
          const ae = a.name.toLocaleLowerCase() === lq ? 0
            : a.name.toLocaleLowerCase().startsWith(lq) ? 1
              : a.kind.startsWith('eu_') ? 2 : 3;
          const ce = c.name.toLocaleLowerCase() === lq ? 0
            : c.name.toLocaleLowerCase().startsWith(lq) ? 1
              : c.kind.startsWith('eu_') ? 2 : 3;
          return ae - ce || a.name.localeCompare(c.name);
        })
        .slice(0, 8));
    }
    return () => { clearTimeout(tid); ctl.abort(); };
  }, [query]);

  const pickPlace = (p: PlaceHit) => {
    const b = built.current;
    if (!b) return;
    const lc = p.ags.slice(0, 2);
    const kc = p.ags.slice(0, 5);
    const chain = [-Number(lc), -(1000 + Number(kc.slice(0, 3))),
                   -(100000 + Number(kc))];
    let last: number | null = null;
    for (const id of chain) {
      if (b.byId.has(id)) { expandPathTo(id, false); expand(id); last = id; }
    }
    if (last != null) {
      const v = vn.current.get(last);
      if (v) target.current = { x: v.tx, y: v.ty, z: 1.3 };
    }
    setQuery('');
    setPlaceHits([]); setAuthHits([]);
  };

  const pickAuthority = (n: ONode) => {
    expandPathTo(n.id);
    focus.current.add(n.id);
    setQuery('');
    setPlaceHits([]); setAuthHits([]);
  };

  // ------------------------------------------------------ interaction
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // An opaque, desynchronised canvas avoids the compositor repeatedly
    // blending a large transparent layer over the frosted page surface.
    const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
    if (!ctx) return;
    let raf = 0;
    let scheduled = false;
    let disposed = false;
    let hasMeasured = false;
    let lastCssWidth = 0;
    let tick: FrameRequestCallback = () => {};
    const schedule = () => {
      if (scheduled || disposed) return;
      scheduled = true;
      raf = requestAnimationFrame((time) => tick(time));
    };
    wake.current = schedule;
    // Above 2x, canvas memory and paint cost rise sharply without improving
    // legibility of these small graph marks.
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      const cssWidth = Math.max(1, canvas.clientWidth);
      const width = Math.max(1, Math.round(canvas.clientWidth * dpr));
      const pxHeight = Math.max(1, Math.round(height * dpr));
      const overviewOnly = expanded.current.size === 1
        && expanded.current.has(WORKSPACE_ROOT);
      if (!hasMeasured || (overviewOnly && Math.abs(cssWidth - lastCssWidth) > 1)) {
        Object.assign(cam.current, overviewCamera(cssWidth));
        target.current = null;
        hasMeasured = true;
      }
      lastCssWidth = cssWidth;
      if (canvas.width === width && canvas.height === pxHeight) return;
      canvas.width = width;
      canvas.height = pxHeight;
      invalidate();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const pointers = new Map<number, { x: number; y: number }>();
    const st = { moved: 0, pinchD: 0 };
    const toWorld = (px: number, py: number) => {
      const r = canvas.getBoundingClientRect();
      return {
        x: (px - r.left - canvas.clientWidth / 2) / cam.current.z + cam.current.x,
        y: (py - r.top - height / 2) / cam.current.z + cam.current.y,
      };
    };
    const visList = (): VNode[] => {
      const out: VNode[] = [];
      for (const id of visibleIds()) {
        const v = vn.current.get(id);
        if (v) out.push(v);
      }
      return out;
    };
    const nodeAt = (wx: number, wy: number): VNode | null => {
      const rr = 14 / cam.current.z + 8;
      let best: VNode | null = null;
      let bd = rr * rr;
      for (const v of visList()) {
        if (v.id === WORKSPACE_ROOT) continue;
        const dd = (v.x - wx) ** 2 + (v.y - wy) ** 2;
        if (dd < bd) { bd = dd; best = v; }
      }
      return best;
    };

    const onDown = (e: PointerEvent) => {
      // Direct manipulation always wins immediately over a pending fly-to.
      // Waiting until the first pointermove allowed one extra animation frame
      // to pull the map sideways after an authority card was closed.
      target.current = null;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 1) {
        st.moved = 0;
      } else if (pointers.size === 2) {
        // A pinch must never become a click when the last finger lifts.
        st.moved = 10;
        const [p1, p2] = [...pointers.values()];
        st.pinchD = Math.hypot(p1.x - p2.x, p1.y - p2.y);
      }
      canvas.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      const prev = pointers.get(e.pointerId);
      if (prev) {
        const dx = e.clientX - prev.x, dy = e.clientY - prev.y;
        pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pointers.size === 1) {
          st.moved += Math.abs(dx) + Math.abs(dy);
          cam.current.x -= dx / cam.current.z;
          cam.current.y -= dy / cam.current.z;
          target.current = null;
          invalidate();
        } else if (pointers.size === 2) {
          const [p1, p2] = [...pointers.values()];
          const nd = Math.hypot(p1.x - p2.x, p1.y - p2.y);
          if (st.pinchD > 0) {
            cam.current.z = Math.min(
              5, Math.max(0.18, cam.current.z * (nd / st.pinchD)));
          }
          st.pinchD = nd;
          target.current = null;
          invalidate();
        }
      } else if (pointers.size === 0) {
        const w = toWorld(e.clientX, e.clientY);
        const h = nodeAt(w.x, w.y);
        if (h !== hover.current) {
          hover.current = h;
          setHoverInfo(h);
          invalidate();
        }
      }
    };
    const onLeave = () => {
      if (pointers.size > 0) return;
      hover.current = null;
      setHoverInfo(null);
      invalidate();
    };
    const onUp = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      if (pointers.size > 0) return;
      if (st.moved < 6) {
        const w = toWorld(e.clientX, e.clientY);
        const v = nodeAt(w.x, w.y);
        if (v) {
          const kids = childIds(v.id);
          if (expanded.current.has(v.id) && v.id !== WORKSPACE_ROOT) {
            collapse(v.id);
          } else if (kids.length > 0) {
            expand(v.id);
            target.current = { x: v.tx, y: v.ty,
                               z: Math.max(cam.current.z, 0.9) };
          } else if (!v.virtual) {
            inspect.current(v.id);
          }
        }
      }
    };
    const onDbl = (e: MouseEvent) => {
      const w = toWorld(e.clientX, e.clientY);
      const v = nodeAt(w.x, w.y);
      if (v && !v.virtual) inspect.current(v.id);
    };
    const onWheel = (e: WheelEvent) => {
      // The graph sits in the page flow: a plain wheel must keep scrolling
      // the page, or scrolling stalls whenever the pointer crosses the
      // canvas. Zoom takes Ctrl/Cmd + wheel — which is also how a trackpad
      // pinch arrives — or the +/− buttons.
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const f = e.deltaY < 0 ? 1.13 : 0.88;
      cam.current.z = Math.min(5, Math.max(0.18, cam.current.z * f));
      target.current = null;
      invalidate();
    };
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerleave', onLeave);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    canvas.addEventListener('dblclick', onDbl);
    canvas.addEventListener('wheel', onWheel, { passive: false });

    // ------------------------------------------------ animation + draw
    tick = () => {
      scheduled = false;
      if (disposed) return;
      const tgt = target.current;
      if (tgt) {
        const c = cam.current;
        c.x += (tgt.x - c.x) * 0.12;
        c.y += (tgt.y - c.y) * 0.12;
        c.z += (tgt.z - c.z) * 0.12;
        dirty.current = true;
        if (Math.abs(tgt.x - c.x) < 0.5 &&
            Math.abs(tgt.y - c.y) < 0.5 &&
            Math.abs(tgt.z - c.z) < 0.01) {
          c.x = tgt.x; c.y = tgt.y; c.z = tgt.z;
          target.current = null;
        }
      }
      const b = built.current;
      const vis = b ? visibleIds() : new Set<number>();
      const list: VNode[] = [];
      for (const id of vis) {
        const v = vn.current.get(id);
        if (v) list.push(v);
      }
      // Deterministic easing to collision-aware target slots. The old live
      // force pass kept every node moving for 90 frames and was the source of
      // visible label shimmer and avoidable CPU/GPU work.
      if (settling.current > 0) {
        settling.current--;
        dirty.current = true;
        for (const v of list) {
          if (settling.current === 0) {
            v.x = v.tx; v.y = v.ty;
          } else {
            v.x += (v.tx - v.x) * 0.24;
            v.y += (v.ty - v.y) * 0.24;
          }
        }
      }
      if (!dirty.current) return;
      dirty.current = false;

      const w = canvas.clientWidth;
      const pt = paint.current ?? (paint.current = readPaint(canvas));
      const hex = (hue: LineHue) => lineHex(hue, pt.dark) ?? pt.ink;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalAlpha = 1;
      ctx.fillStyle = pt.surface;
      ctx.fillRect(0, 0, w, height);
      if (b) {
        const { x, y, z } = cam.current;
        ctx.save();
        ctx.translate(w / 2, height / 2);
        ctx.scale(z, z);
        ctx.translate(-x, -y);

        // hover branch: the hovered node, its ancestor path and its
        // direct children — everything else recedes
        let branch: Set<number> | null = null;
        if (hover.current) {
          branch = new Set<number>([hover.current.id]);
          let cur: number | undefined = hover.current.id;
          while (cur != null && cur !== WORKSPACE_ROOT) {
            cur = b.upOf.get(cur);
            if (cur != null) branch.add(cur);
          }
          for (const c of childIds(hover.current.id)) branch.add(c);
          for (const f of focus.current) branch.add(f);
        }
        const inBranch = (id: number) => !branch || branch.has(id);
        const active = (id: number) =>
          expanded.current.has(id) || focus.current.has(id) ||
          hover.current?.id === id;

        // tree edges between visible nodes (slightly curved). Recorded
        // structure is plain ink; only a court route carries its hue.
        for (const id of vis) {
          const up = b.upOf.get(id);
          if (up == null) continue;
          // Links to the hidden workspace only group the two domains and do
          // not claim a relationship between them.
          if (up === WORKSPACE_ROOT || id === WORKSPACE_ROOT) continue;
          const a = vn.current.get(id), p = vn.current.get(up);
          if (!a || !p) continue;
          const line = REL_LINES[b.upRelOf.get(id) ?? 'virtual']
            ?? REL_LINES.virtual;
          const hot = active(id) || active(up);
          const faded = branch && !(inBranch(id) && inBranch(up));
          ctx.strokeStyle = hex(line.hue);
          ctx.globalAlpha = faded ? 0.08
            : line.hue !== 'ink' ? 0.9
              : hot ? 0.62 : pt.contrast ? 0.5 : 0.24;
          ctx.lineWidth = (hot ? 1.6 : 1) / z;
          ctx.setLineDash(line.dash.map((n) => n / z));
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          const mx = (p.x + a.x) / 2, my = (p.y + a.y) / 2;
          ctx.quadraticCurveTo(
            mx + (p.y - a.y) * 0.08, my + (a.x - p.x) * 0.08, a.x, a.y);
          ctx.stroke();
        }
        // Secondary relations are indexed by visible source node. This is
        // O(visible degree), not O(all graph edges), and arrows preserve the
        // recorded direction. Co-legislation stays deliberately arrowless.
        for (const source of vis) {
          for (const l of b.secondaryFrom.get(source) ?? []) {
            if (!vis.has(l.b)) continue;
            const a = vn.current.get(l.a), c2 = vn.current.get(l.b);
            if (!a || !c2) continue;
            const contextual = branch
              ? inBranch(l.a) && inBranch(l.b)
              : focus.current.has(l.a) || focus.current.has(l.b) ||
                hover.current?.id === l.a || hover.current?.id === l.b;
            if (!relationsAll.current && !contextual) continue;
            const line = REL_LINES[l.rel] ?? REL_LINES.supervision;
            const color = hex(line.hue);
            ctx.globalAlpha = line.hue === 'ink' ? 0.6 : 0.92;
            ctx.strokeStyle = color;
            ctx.lineWidth = 1.4 / z;
            ctx.setLineDash(line.dash.map((n) => n / z));
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            const mx = (a.x + c2.x) / 2, my = (a.y + c2.y) / 2;
            const controlX = mx + (a.y - c2.y) * 0.22;
            const controlY = my + (c2.x - a.x) * 0.22;
            ctx.quadraticCurveTo(controlX, controlY, c2.x, c2.y);
            ctx.stroke();
            if (relationIsDirected(l.rel)) {
              arrowHead(ctx, controlX, controlY, c2.x, c2.y,
                        nodeRadius(c2, focus.current.has(c2.id)), z, color);
            }
          }
        }
        // thread: place authorities -> their competent court
        if (fLinks.current.length) {
          ctx.globalAlpha = 1;
          ctx.setLineDash(COURT_THREAD.dash.map((n) => n / z));
          ctx.strokeStyle = hex(COURT_THREAD.hue);
          ctx.lineWidth = 2 / z;
          for (const [fa, fb] of fLinks.current) {
            const a = vn.current.get(fa), c2 = vn.current.get(fb);
            if (!a || !c2 || !vis.has(fa) || !vis.has(fb)) continue;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            const mx = (a.x + c2.x) / 2, my = (a.y + c2.y) / 2;
            ctx.quadraticCurveTo(
              mx + (a.y - c2.y) * 0.3, my + (c2.x - a.x) * 0.3,
              c2.x, c2.y);
            ctx.stroke();
          }
        }
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;

        // nodes — hue = domain, shape = kind of thing (see graphStyle):
        // dot = authority, diamond = court, ring = view group.
        for (const v of list) {
          if (v.id === WORKSPACE_ROOT) continue;
          const kids = childIds(v.id);
          const isOpen = expanded.current.has(v.id);
          const isFocus = focus.current.has(v.id);
          const isHover = hover.current === v;
          const domain = v.id === EU_DOMAIN || v.id === GERMANY_DOMAIN;
          // expanded parents recede: the level is done, attention belongs
          // to its children
          const shadowParent = isOpen && !isHover && !isFocus && !domain;
          const dim = branch ? !inBranch(v.id) && !isHover
            : false;
          const r = nodeRadius(v);
          const rr = isFocus ? r * 1.5 : r;
          const shape = nodeShape(v.kind, v.virtual);
          const col = nodeHex(nodeHue(v.kind, v.virtual), pt.dark) ?? pt.muted;
          const alpha = dim ? 0.16 : shadowParent ? 0.5 : 1;
          ctx.globalAlpha = alpha;
          if ((isHover || isFocus) && !dim) {
            // one crisp ring: brand colour = competent here / picked,
            // ink = under the pointer
            ctx.strokeStyle = isFocus ? pt.link : pt.ink;
            ctx.lineWidth = 2 / z;
            ctx.beginPath();
            ctx.arc(v.x, v.y, (shape === 'diamond' ? rr * 1.2 : rr) + 4 / z,
                    0, Math.PI * 2);
            ctx.stroke();
          }
          ctx.beginPath();
          if (shape === 'diamond') {
            const d = rr * 1.2;
            ctx.moveTo(v.x, v.y - d);
            ctx.lineTo(v.x + d, v.y);
            ctx.lineTo(v.x, v.y + d);
            ctx.lineTo(v.x - d, v.y);
            ctx.closePath();
          } else {
            ctx.arc(v.x, v.y, rr, 0, Math.PI * 2);
          }
          if (shape === 'ring') {
            ctx.fillStyle = pt.surface;
            ctx.fill();
            ctx.strokeStyle = col;
            ctx.lineWidth = Math.min((domain ? 3 : 2) / z, rr * 0.5);
            ctx.stroke();
          } else {
            ctx.fillStyle = col;
            ctx.fill();
            // a thin surface gap keeps touching marks apart
            ctx.strokeStyle = pt.contrast ? pt.ink : pt.surface;
            ctx.lineWidth = 1.25 / z;
            ctx.stroke();
          }
          if (kids.length > 0 && !isOpen) {
            // "+N hidden below": a small pill of constant size on screen
            // (it used to balloon when zoomed in)
            const k = 1 / z;
            const text = kids.length > 99 ? '99+' : `+${kids.length}`;
            const fpx = 9.5 * pt.scale * k;
            ctx.font = `600 ${fpx}px ${pt.font}`;
            const bh = fpx + 5 * k;
            const bw = Math.max(bh, ctx.measureText(text).width + 7 * k);
            const bx = v.x + r * 0.55;
            const by = v.y - r * 0.9 - bh * 0.75;
            ctx.beginPath();
            ctx.moveTo(bx + bh / 2, by);
            ctx.arcTo(bx + bw, by, bx + bw, by + bh, bh / 2);
            ctx.arcTo(bx + bw, by + bh, bx, by + bh, bh / 2);
            ctx.arcTo(bx, by + bh, bx, by, bh / 2);
            ctx.arcTo(bx, by, bx + bw, by, bh / 2);
            ctx.closePath();
            ctx.fillStyle = pt.surface;
            ctx.fill();
            ctx.strokeStyle = pt.muted;
            ctx.lineWidth = 1 / z;
            ctx.stroke();
            ctx.fillStyle = pt.ink;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(text, bx + bw / 2, by + bh / 2 + 0.5 * k);
            ctx.textAlign = 'left';
            ctx.textBaseline = 'alphabetic';
          }
          ctx.globalAlpha = 1;
        }
        ctx.restore();

        // Collision-safe labels in screen space. Text stays crisp and the
        // occupied-rectangle pass prevents labels from painting over each
        // other as branches animate or the viewport changes.
        const occupied: ScreenRect[] = [
          // the zoom controls, bottom right
          { x: w - 62, y: height - 200, w: 62, h: 200 },
        ];
        const priority = (v: VNode) => hover.current === v ? 100
          : focus.current.has(v.id) ? 90
            : v.id === EU_DOMAIN || v.id === GERMANY_DOMAIN ? 80
              : v.virtual && !expanded.current.has(v.id) ? 60
                : v.virtual ? 50 : 20;
        const labels = list
          .filter((v) => v.id !== WORKSPACE_ROOT)
          .sort((a, c) => priority(c) - priority(a) || a.id - c.id);
        // The marks themselves are obstacles too: a name is never painted
        // over somebody else's node.
        if (labels.length <= 600) {
          for (const v of labels) {
            const sx = (v.x - x) * z + w / 2;
            const sy = (v.y - y) * z + height / 2;
            if (sx < 0 || sx > w || sy < 0 || sy > height) continue;
            const rpx = nodeRadius(v, focus.current.has(v.id)) * z + 2;
            occupied.push({ x: sx - rpx, y: sy - rpx, w: rpx * 2, h: rpx * 2 });
          }
        }
        ctx.textBaseline = 'middle';
        for (const v of labels) {
          const key = priority(v) >= 80;
          const isVirtual = Boolean(v.virtual);
          const show = key || isVirtual ||
            (z >= 1.05 && list.length <= 180);
          if (!show) continue;
          if (branch && !inBranch(v.id) && hover.current !== v) continue;
          const sx = (v.x - x) * z + w / 2;
          const sy = (v.y - y) * z + height / 2;
          if (sx < -40 || sx > w + 40 || sy < -20 || sy > height + 20) {
            continue;
          }
          const domain = v.id === EU_DOMAIN || v.id === GERMANY_DOMAIN;
          const fontSize = (domain ? 14 : 12) * pt.scale;
          ctx.font = `${domain || isVirtual || key ? 600 : 400} ${fontSize}px ${pt.font}`;
          const limit = key ? 56 : 36;
          const label = v.name.length > limit
            ? `${v.name.slice(0, limit - 1)}…` : v.name;
          const tw = Math.ceil(ctx.measureText(label).width);
          const lh = Math.ceil(fontSize) + 7;
          const nodePx = nodeRadius(v, focus.current.has(v.id)) * z
            * (nodeShape(v.kind, v.virtual) === 'diamond' ? 1.2 : 1);
          // Candidate slots around the node, best first. The two entry
          // labels face away from the centre; where that side would leave
          // the canvas (a phone) the label moves under its node instead of
          // being clamped on top of it or of the other entry.
          const centred = Math.max(6, Math.min(w - tw - 6, sx - tw / 2));
          const right = { x: sx + nodePx + 8, y: sy - lh / 2 };
          const left = { x: sx - nodePx - 8 - tw, y: sy - lh / 2 };
          const below = { x: centred, y: sy + nodePx + 5 };
          const above = { x: centred, y: sy - nodePx - 5 - lh };
          const slots = v.id === EU_DOMAIN ? [left, below, above, right]
            : v.id === GERMANY_DOMAIN ? [right, below, above, left]
              : [right, left, below, above];
          const rectOf = (s: { x: number; y: number }): ScreenRect =>
            ({ x: s.x - 4, y: s.y, w: tw + 8, h: lh });
          const inside = (r: ScreenRect) => r.x >= 2 && r.x + r.w <= w - 2;
          const free = (r: ScreenRect) =>
            !occupied.some((o) => overlaps(r, o));
          const candidates = slots.map(rectOf);
          let rect = candidates.find((r) => inside(r) && free(r));
          if (!rect) {
            if (!key) continue;
            // a key label is never dropped: take the slot that covers the
            // least of what is already there, clamped as a last resort
            const covered = (r: ScreenRect) => occupied.reduce((sum, o) =>
              sum + Math.max(0, Math.min(r.x + r.w, o.x + o.w) - Math.max(r.x, o.x))
                  * Math.max(0, Math.min(r.y + r.h, o.y + o.h) - Math.max(r.y, o.y)), 0);
            const fitting = candidates.filter(inside);
            rect = fitting.length
              ? fitting.reduce((best, r) => covered(r) < covered(best) ? r : best)
              : rectOf(below);
            rect.x = Math.max(2, Math.min(w - rect.w - 2, rect.x));
          }
          occupied.push(rect);
          // A halo in the surface colour instead of a box: the name stays
          // readable where it crosses lines, and nothing looks boxed in.
          ctx.lineJoin = 'round';
          ctx.strokeStyle = pt.surface;
          ctx.lineWidth = 4;
          ctx.strokeText(label, rect.x + 4, rect.y + lh / 2 + 0.5);
          ctx.fillStyle = pt.ink;
          ctx.fillText(label, rect.x + 4, rect.y + lh / 2 + 0.5);
        }
        ctx.textBaseline = 'alphabetic';
      }
      if (target.current || settling.current > 0) schedule();
    };
    schedule();
    return () => {
      disposed = true;
      wake.current = () => {};
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerleave', onLeave);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      canvas.removeEventListener('dblclick', onDbl);
      canvas.removeEventListener('wheel', onWheel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [height]);

  const zoomBy = (f: number) => {
    cam.current.z = Math.min(5, Math.max(0.18, cam.current.z * f));
    target.current = null;
    invalidate();
  };

  const toggleRelations = () => {
    const next = !relationsAll.current;
    relationsAll.current = next;
    setAllRelations(next);
    invalidate();
  };

  const showDropdown = placeHits.length > 0 || authHits.length > 0;
  const hitRow = 'flex w-full min-h-11 items-center justify-between gap-3 px-3.5 py-2 text-left text-sm text-main hover:bg-[var(--c-text-main)]/[0.06]';
  const collapseAll = () => {
    expanded.current = new Set([WORKSPACE_ROOT]);
    settling.current = 24;
    target.current = overviewCamera(canvasRef.current?.clientWidth ?? 1);
    invalidate();
  };
  const canvasButton = 'flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--panel-border)] bg-[var(--panel-bg-solid)] text-main transition-colors hover:border-[var(--c-text-main)]';

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="sntiq-search w-full max-w-md">
          <Search aria-hidden="true" />
          <input
            type="text"
            className="sntiq-field"
            placeholder={t('germanySearch')}
            aria-label={t('germanySearch')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {showDropdown && (
            <div className="sntiq-float absolute z-20 mt-1 w-full overflow-hidden">
              {placeHits.map((p) => (
                <button
                  key={`p-${p.ags}-${p.plz ?? ''}`}
                  type="button"
                  className={hitRow}
                  onClick={() => pickPlace(p)}
                >
                  <span className="min-w-0 break-words">
                    <span className="font-semibold">{p.name}</span>
                    <span className="text-muted"> ({p.land})</span>
                  </span>
                  <span className="sntiq-kicker shrink-0">{t('searchPlace')}</span>
                </button>
              ))}
              {authHits.map((n) => (
                <button
                  key={`a-${n.id}`}
                  type="button"
                  className={hitRow}
                  onClick={() => pickAuthority(n)}
                >
                  <span className="min-w-0 break-words">{n.name.length > 56
                    ? n.name.slice(0, 55) + '…' : n.name}</span>
                  <span className="sntiq-kicker max-w-[42%] shrink-0 text-right">
                    {t(`kind.${n.kind}`, { defaultValue: t('searchAuthority') })}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={toggleRelations}
          aria-pressed={allRelations}
          className={`sntiq-btn text-sm ${
            allRelations
              ? 'border-[var(--c-text-main)] forced-colors:outline forced-colors:outline-2 forced-colors:-outline-offset-2 forced-colors:outline-[Highlight] [.high-contrast_&]:underline [.high-contrast_&]:decoration-2 [.high-contrast_&]:underline-offset-4'
              : 'text-muted hover:text-main'}`}
        >
          {t(allRelations ? 'relations.all' : 'relations.context')}
        </button>
        {/* Collapsing branches is named in words beside the other view
            control; under the zoom buttons two chevrons read as "squeeze". */}
        <button type="button" onClick={collapseAll} className="sntiq-btn text-sm text-muted hover:text-main">
          {t('collapseAll')}
        </button>
        </div>
      </div>
      <div className="relative isolate overflow-hidden rounded-xl border border-[var(--panel-border)] bg-[var(--panel-bg)] [contain:layout_paint]">
        <canvas
          ref={canvasRef}
          aria-label={t('graphCanvasLabel')}
          className="block w-full cursor-grab active:cursor-grabbing touch-none"
          style={{ height }}
        />
        {/* loading and failure live INSIDE the canvas frame: a line above it
            used to push the whole graph down and back up */}
        {(loading || failed) && (
          <div role="status"
               className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center text-sm text-main">
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                {t('germanyLoading')}
              </span>
            ) : (
              <>
                <span>{t('graphError')}</span>
                <button type="button" className="sntiq-btn"
                        onClick={() => { setLoading(true); setFailed(false); setAttempt((n) => n + 1); }}>
                  {t('retry')}
                </button>
              </>
            )}
          </div>
        )}
        {hoverInfo && (
          <div className="sntiq-float absolute left-3 bottom-3 max-w-[min(70%,30rem)] px-3 py-2 pointer-events-none">
            <p className="text-sm font-semibold text-main truncate">
              {hoverInfo.name}
            </p>
            <p className="sntiq-kicker">
              {t(`kind.${hoverInfo.kind}`, { defaultValue: hoverInfo.kind })}
            </p>
          </div>
        )}
        <div className="absolute right-3 bottom-3 flex flex-col gap-1.5">
          {([[Plus, () => zoomBy(1.35), 'zoomIn'],
             [Minus, () => zoomBy(0.74), 'zoomOut'],
             [Focus, () => {
               target.current = overviewCamera(canvasRef.current?.clientWidth ?? 1);
               invalidate();
             }, 'resetView']] as [React.ElementType, () => void, string][])
            .map(([Icon, fn, label]) => (
            <button
              key={label}
              type="button"
              onClick={fn}
              aria-label={t(label)}
              title={t(label)}
              className={canvasButton}
            >
              <Icon className="w-4 h-4" aria-hidden="true" />
            </button>
          ))}
        </div>
      </div>

      {/* The legend is always on screen: colour, shape and dash carry the
          meaning of the picture, so they are never behind a disclosure. */}
      <div className="mt-4 grid gap-x-10 gap-y-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]"
           role="group" aria-label={t('legendTitle')}>
        <div>
          <p className="sntiq-kicker mb-2">{t('legend.nodes')}</p>
          <ul className="flex flex-wrap gap-x-5 gap-y-2 text-[13px] leading-snug text-main">
            {LEGEND_NODES.map(([kind, virtual, label]) => (
              <li key={label} className="inline-flex items-center gap-1.5">
                <NodeMark kind={kind} virtual={virtual} />
                {t(label)}
              </li>
            ))}
            <li className="inline-flex items-center gap-1.5">
              <svg viewBox="0 0 14 14" aria-hidden="true" focusable="false"
                   className="h-3.5 w-3.5 shrink-0 text-[var(--c-link)]">
                <circle cx="7" cy="7" r="5.8" fill="none" stroke="currentColor" strokeWidth="1.6" />
                <circle cx="7" cy="7" r="2.6" fill="var(--c-text-muted)" />
              </svg>
              {t('legend.focus')}
            </li>
          </ul>
        </div>
        <div>
          <p className="sntiq-kicker mb-2">{t('legend.relations')}</p>
          <ul className="flex flex-wrap gap-x-5 gap-y-2 text-[13px] leading-snug text-main">
            {LEGEND_LINES.map(([rel, label, arrow]) => (
              <li key={rel} className="inline-flex items-center gap-2">
                <LineMark hue={REL_LINES[rel].hue} dash={REL_LINES[rel].dash}
                          arrow={arrow} />
                {t(label)}
              </li>
            ))}
            {(focusLinks?.length ?? 0) > 0 && (
              <li className="inline-flex items-center gap-2">
                <LineMark hue={COURT_THREAD.hue} dash={COURT_THREAD.dash}
                          arrow={false} bold />
                {t('legend.courtThread')}
              </li>
            )}
          </ul>
        </div>
      </div>
      <p className="mt-4 max-w-[72ch] text-sm leading-relaxed text-muted">
        {t('germanyHint')}
      </p>
      <p className="mt-2 max-w-[72ch] text-[13px] leading-relaxed text-muted">
        {t('euRelationsCaveat')}
      </p>
    </div>
  );
};

export default GermanyGraph;
