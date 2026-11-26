'use client';

/**
 * Stable, clustered view of the Kerf QFS arena.
 *
 * The graph deliberately groups unlike roles (instruments, procedures,
 * actors, topics and evidence) instead of pretending that their screen
 * position is a legal hierarchy.  The overview draws aggregate inter-cluster
 * links; individual relations appear only on node focus or explicit “show
 * all”.  There is no force simulation, so the graph neither drifts nor burns
 * animation frames while idle.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Minus, Pause, Play, Plus, Search, ArrowLeft, ArrowRight, X, RotateCcw, Focus, TriangleAlert } from 'lucide-react';
import { kerfUrl } from '../../core/config';
import SplitPanes from '@/core/SplitPanes';
import { useMediaQuery } from '@/core/useMediaQuery';
import { formatDay } from '@/core/formatDay';
import { useTheme } from '../../core/shell/ThemeProvider';
import { graphActId, graphConnections, graphCopy, graphMatches, graphNodeLabel, graphShortKind } from './graphExplorer';
import type { KerfAct } from './client';
import styles from './graph.module.css';
import {
  buildChronologyLayout, buildClusteredLayout, chronologyFollowCamera,
  routeClusterConnection, routeClusterConnections,
  KIND_META, KIND_ORDER,
  type ChronologyLayout, type ClusterBox, type LayoutNode, type KerfBelief,
  type KerfEdge, type KerfNode, type RoutePoint,
} from './kerfArenaLayout';
import './i18n/register';

interface KerfWorld { id: number; stability: number; }
interface KerfData {
  nodes: KerfNode[];
  edges: KerfEdge[];
  beliefs: KerfBelief[];
  ticks: number[];
  tick_labels: Record<number, string>;
  worlds: KerfWorld[];
}

/** The canvas draws in the site's tokens (DESIGN.md section 3): ink, muted
 *  text, the stage ground, the module colour and the graph kinds (--g-*).
 *  Custom properties can hold var() and color-mix(), which a canvas cannot
 *  read, so each is resolved to rgb() through a probe element once per theme. */
interface GraphPalette {
  dark: boolean; contrast: boolean;
  ink: string; muted: string; paper: string; link: string;
  kinds: Record<string, string>;
}
const FALLBACK = { ink: 'rgb(17, 17, 17)', muted: 'rgb(90, 106, 128)', paper: 'rgb(238, 240, 243)', link: 'rgb(142, 97, 22)' };
function readPalette(probe: HTMLElement | null, stage: HTMLElement | null, dark: boolean, contrast: boolean): GraphPalette {
  const resolve = (value: string, fallback: string) => {
    if (!probe) return fallback;
    probe.style.color = fallback;
    probe.style.color = value;
    return getComputedStyle(probe).color || fallback;
  };
  const ink = resolve('var(--c-text-main)', FALLBACK.ink);
  const kinds: Record<string, string> = {};
  for (const kind of KIND_ORDER) kinds[kind] = contrast ? ink : resolve(`var(--g-${kind})`, FALLBACK.muted);
  return {
    dark, contrast, ink, kinds,
    muted: contrast ? ink : resolve('var(--c-text-muted)', FALLBACK.muted),
    paper: (stage && getComputedStyle(stage).backgroundColor) || FALLBACK.paper,
    link: contrast ? ink : resolve('var(--c-link)', FALLBACK.link),
  };
}
/** rgb(r, g, b) → rgba(r, g, b, a) */
const alpha = (rgb: string, a: number) => rgb.replace(/^rgba?\(([^,]+),([^,]+),([^,)]+)(?:,[^)]*)?\)$/, `rgba($1,$2,$3,${a})`);
const capitalize = (text: string) => text.charAt(0).toLocaleUpperCase() + text.slice(1);
const SANS = '"Inter", ui-sans-serif, system-ui, sans-serif';
const MONO = '"IBM Plex Mono", ui-monospace, monospace';

const clamp = (value: number, low: number, high: number) =>
  value < low ? low : value > high ? high : value;

/** Full chronology starts in 1863. Mobile "fit" therefore needs to go well
 * below the map's natural zoom while still leaving a finite interaction floor. */
const MIN_ZOOM = 0.0025;

const folded = (value: string) => value
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase();

const visible = (node: LayoutNode, hidden: Set<string>, tick: number) =>
  !hidden.has(node.kind) && node.born <= tick;

/** A kind's colour for HTML (swatches): the token itself. */
const kindVar = (kind: string) => `var(--g-${kind}, var(--c-text-muted))`;

function traceRoundedRoute(
  ctx: CanvasRenderingContext2D, points: RoutePoint[], radius = 10,
) {
  if (points.length < 2) return;
  ctx.moveTo(points[0].x, points[0].y);
  for (let index = 1; index < points.length - 1; index++) {
    const previous = points[index - 1];
    const corner = points[index];
    const next = points[index + 1];
    const incoming = Math.hypot(corner.x - previous.x, corner.y - previous.y);
    const outgoing = Math.hypot(next.x - corner.x, next.y - corner.y);
    const bend = Math.min(radius, incoming / 2, outgoing / 2);
    const before = {
      x: corner.x + (previous.x - corner.x) / Math.max(1, incoming) * bend,
      y: corner.y + (previous.y - corner.y) / Math.max(1, incoming) * bend,
    };
    const after = {
      x: corner.x + (next.x - corner.x) / Math.max(1, outgoing) * bend,
      y: corner.y + (next.y - corner.y) / Math.max(1, outgoing) * bend,
    };
    ctx.lineTo(before.x, before.y);
    ctx.quadraticCurveTo(corner.x, corner.y, after.x, after.y);
  }
  const last = points[points.length - 1];
  ctx.lineTo(last.x, last.y);
}

function routePointAt(points: RoutePoint[], fraction: number) {
  const lengths = points.slice(1).map((point, index) =>
    Math.hypot(point.x - points[index].x, point.y - points[index].y));
  const total = lengths.reduce((sum, length) => sum + length, 0);
  let remaining = total * clamp(fraction, 0, 1);
  for (let index = 0; index < lengths.length; index++) {
    if (remaining <= lengths[index]) {
      const ratio = lengths[index] ? remaining / lengths[index] : 0;
      return {
        x: points[index].x + (points[index + 1].x - points[index].x) * ratio,
        y: points[index].y + (points[index + 1].y - points[index].y) * ratio,
      };
    }
    remaining -= lengths[index];
  }
  return points[points.length - 1] ?? { x: 0, y: 0 };
}

interface LabelRect { left: number; top: number; right: number; bottom: number; }
const overlaps = (a: LabelRect, b: LabelRect) => !(
  a.right + 3 < b.left || b.right + 3 < a.left
  || a.bottom + 3 < b.top || b.bottom + 3 < a.top
);

const KerfArenaGraph: React.FC<{ className?: string; acts?: KerfAct[]; onOpenAct?: (id: string) => void; visible?: boolean }> = ({ className = '', acts = [], onOpenAct, visible: active = true }) => {
  const { t, i18n } = useTranslation('kerf');
  const copy = graphCopy(i18n.language);
  const { isReducedMotion, isDark, isHighContrast } = useTheme();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const filtersRef = useRef<HTMLDivElement>(null);
  const filtersButton = useRef<HTMLButtonElement>(null);
  const probeRef = useRef<HTMLSpanElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const palette = useRef<GraphPalette>({ dark: isDark, contrast: isHighContrast, ...FALLBACK, kinds: {} });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [data, setData] = useState<KerfData | null>(null);
  const [offKinds, setOffKinds] = useState<Set<string>>(new Set());
  const [tick, setTick] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [search, setSearch] = useState('');
  const [showAllEdges, setShowAllEdges] = useState(false);
  const [inspectedId, setInspectedId] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<'map' | 'chronology'>('map');
  const [attempt, setAttempt] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [listOpen, setListOpen] = useState(true);
  const stacked = useMediaQuery('(max-width: 700px)');
  const [resultLimit, setResultLimit] = useState(60);
  const labels = useMemo(() => data?.nodes.map(node => graphNodeLabel(node, acts)) ?? [], [data, acts]);
  const nodeLabels = useRef<string[]>([]);
  useEffect(() => { nodeLabels.current = labels; invalidate.current(); }, [labels]);

  const nodes = useRef<LayoutNode[]>([]);
  const edges = useRef<KerfEdge[]>([]);
  const clusters = useRef<ClusterBox[]>([]);
  const aggregateRoutes = useRef(new Map<string, RoutePoint[]>());
  const chronology = useRef<ChronologyLayout | null>(null);
  const mode = useRef<'map' | 'chronology'>('map');
  const camera = useRef({ tx: 0, ty: 0, zoom: 1 });
  const viewport = useRef({ width: 0, height: 0 });
  const savedCameras = useRef<Record<'map' | 'chronology', {
    tx: number; ty: number; zoom: number;
  } | null>>({ map: null, chronology: null });
  const cameraAnimation = useRef<{
    start: number;
    duration: number;
    from: { tx: number; ty: number; zoom: number };
    to: { tx: number; ty: number; zoom: number };
  } | null>(null);
  const hasFramed = useRef(false);
  const hiddenKinds = useRef<Set<string>>(new Set());
  const currentTick = useRef(Infinity);
  const matches = useRef<Set<number> | null>(null);
  const hover = useRef<number | null>(null);
  const selected = useRef<number | null>(null);
  const forceAllEdges = useRef(false);
  const reduceMotion = useRef(false);
  const invalidate = useRef<() => void>(() => undefined);

  useEffect(() => {
    if (!active) { setPlaying(false); setFiltersOpen(false); cameraAnimation.current = null; }
    else invalidate.current();
  }, [active]);

  useEffect(() => {
    if (!filtersOpen || !active) return;
    const outside = (event: Event) => {
      if (!filtersRef.current?.contains(event.target as Node) && !filtersButton.current?.contains(event.target as Node)) setFiltersOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setFiltersOpen(false); filtersButton.current?.focus(); }
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('focusin', outside);
    document.addEventListener('keydown', escape, true);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('focusin', outside); document.removeEventListener('keydown', escape, true); };
  }, [filtersOpen, active]);

  useEffect(() => {
    reduceMotion.current = isReducedMotion;
    if (isReducedMotion && cameraAnimation.current) {
      Object.assign(camera.current, cameraAnimation.current.to);
      cameraAnimation.current = null;
      invalidate.current();
    }
  }, [isReducedMotion]);

  useEffect(() => {
    palette.current = readPalette(probeRef.current, stageRef.current, isDark, isHighContrast);
    invalidate.current();
  }, [isDark, isHighContrast]);

  const animateCamera = useCallback((to: { tx: number; ty: number; zoom: number }, duration = 350) => {
    if (reduceMotion.current || duration <= 0) {
      Object.assign(camera.current, to);
      cameraAnimation.current = null;
    } else {
      cameraAnimation.current = {
        start: performance.now(), duration,
        from: { ...camera.current }, to,
      };
    }
    invalidate.current();
  }, []);

  const zoomAt = useCallback((sx: number, sy: number, factor: number) => {
    cameraAnimation.current = null;
    const cam = camera.current;
    const wx = (sx - cam.tx) / cam.zoom;
    const wy = (sy - cam.ty) / cam.zoom;
    cam.zoom = clamp(cam.zoom * factor, MIN_ZOOM, 5);
    cam.tx = sx - wx * cam.zoom;
    cam.ty = sy - wy * cam.zoom;
    invalidate.current();
  }, []);

  const fitToView = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !clusters.current.length) return;
    let minX: number, maxX: number, minY: number, maxY: number;
    if (mode.current === 'chronology' && chronology.current) {
      const chrono = chronology.current;
      const shownLanes = chrono.lanes.filter((lane) => !hiddenKinds.current.has(lane.kind));
      if (!shownLanes.length) return;
      minX = chrono.minX;
      maxX = chrono.maxX;
      minY = Math.min(...shownLanes.map((lane) => lane.y - lane.h / 2));
      maxY = Math.max(...shownLanes.map((lane) => lane.y + lane.h / 2));
    } else {
      const shown = clusters.current.filter((box) => !hiddenKinds.current.has(box.kind));
      if (!shown.length) return;
      minX = Math.min(...shown.map((box) => box.x - box.w / 2));
      maxX = Math.max(...shown.map((box) => box.x + box.w / 2));
      minY = Math.min(...shown.map((box) => box.y - box.h / 2));
      maxY = Math.max(...shown.map((box) => box.y + box.h / 2));
    }
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const pad = w < 640 ? 30 : 54;
    const zoom = clamp(Math.min(
      (w - pad * 2) / Math.max(1, maxX - minX),
      (h - pad * 2) / Math.max(1, maxY - minY),
    ), MIN_ZOOM, 5);
    const target = {
      zoom,
      tx: w / 2 - ((minX + maxX) / 2) * zoom,
      ty: h / 2 - ((minY + maxY) / 2) * zoom,
    };
    animateCamera(target, hasFramed.current ? 380 : 0);
    hasFramed.current = true;
  }, [animateCamera]);

  const followChronologyTick = useCallback((tickValue: number, duration = 520) => {
    const canvas = canvasRef.current;
    const chrono = chronology.current;
    if (!canvas || !chrono) return;
    const shownLanes = chrono.lanes.filter((lane) => !hiddenKinds.current.has(lane.kind));
    if (!shownLanes.length) return;
    const minY = Math.min(...shownLanes.map((lane) => lane.y - lane.h / 2));
    const maxY = Math.max(...shownLanes.map((lane) => lane.y + lane.h / 2));
    animateCamera(chronologyFollowCamera(
      chrono,
      tickValue,
      canvas.clientWidth,
      canvas.clientHeight,
      minY,
      maxY,
    ), duration);
  }, [animateCamera]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    setLoading(true);
    setError(false);
    fetch(kerfUrl('/graph'), { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then((graph: KerfData) => {
        if (cancelled) return;
        const layout = buildClusteredLayout(graph.nodes, graph.edges, false);
        nodes.current = layout.nodes;
        edges.current = graph.edges;
        clusters.current = layout.clusters;
        aggregateRoutes.current.clear();
        const routedPairs = new Map<string, {
          sourceKind: string; targetKind: string; weight: number;
        }>();
        for (const edge of graph.edges) {
          const sourceKind = graph.nodes[edge.s]?.kind;
          const targetKind = graph.nodes[edge.t]?.kind;
          if (!sourceKind || !targetKind || sourceKind === targetKind) continue;
          const aKind = sourceKind < targetKind ? sourceKind : targetKind;
          const bKind = sourceKind < targetKind ? targetKind : sourceKind;
          const key = `${aKind}|${bKind}`;
          const pair = routedPairs.get(key);
          if (pair) pair.weight++;
          else routedPairs.set(key, {
            sourceKind: aKind, targetKind: bKind, weight: 1,
          });
        }
        for (const [key, route] of routeClusterConnections(
          layout.clusters, Array.from(routedPairs.values()),
        )) {
          aggregateRoutes.current.set(key, route.points);
        }
        chronology.current = buildChronologyLayout(graph.nodes, graph.beliefs ?? []);
        const last = Math.max(0, graph.ticks.length - 1);
        currentTick.current = graph.ticks[last] ?? Infinity;
        setData(graph);
        setTick(last);
        setLoading(false);
        requestAnimationFrame(() => fitToView());
      })
      .catch(() => {
        if (!cancelled) { setError(true); setLoading(false); }
      });
    return () => { cancelled = true; controller.abort(); };
  }, [fitToView, attempt]);

  useEffect(() => {
    if (!data) return;
    currentTick.current = data.ticks[tick] ?? Infinity;
    if (selected.current != null) {
      const node = nodes.current[selected.current];
      if (!node || !visible(node, hiddenKinds.current, currentTick.current)) {
        selected.current = null;
        hover.current = null;
        setInspectedId(null);
      }
    }
    if (playing && mode.current === 'chronology') {
      followChronologyTick(currentTick.current);
    }
    invalidate.current();
  }, [data, followChronologyTick, playing, tick, viewMode]);

  useEffect(() => {
    hiddenKinds.current = offKinds;
    const node = selected.current == null ? null : nodes.current[selected.current];
    if (node && offKinds.has(node.kind)) { selected.current = null; hover.current = null; setInspectedId(null); }
    invalidate.current();
  }, [offKinds]);

  useEffect(() => {
    const query = folded(search.trim());
    if (!query) {
      matches.current = null;
    }
    else {
      matches.current = new Set(graphMatches(nodes.current, query, offKinds, data?.ticks[tick] ?? Infinity, labels));
    }
    invalidate.current();
  }, [data, search, offKinds, tick, labels]);

  useEffect(() => { setResultLimit(60); }, [search, offKinds, tick, inspectedId]);

  useEffect(() => {
    forceAllEdges.current = showAllEdges;
    invalidate.current();
  }, [showAllEdges]);

  useEffect(() => {
    if (!playing || !data) return;
    const timer = window.setInterval(() => {
      setTick((value) => value >= data.ticks.length - 1 ? 0 : value + 1);
    }, 850);
    return () => window.clearInterval(timer);
  }, [data, playing]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
    if (!ctx) return;

    let raf = 0;
    let scheduled = false;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);

    const isShown = (node: LayoutNode) =>
      visible(node, hiddenKinds.current, currentTick.current);

    const positionOf = (node: LayoutNode): { x: number; y: number } => {
      if (mode.current === 'chronology') {
        const history = chronology.current?.eventsByNode[node.id];
        if (!history?.length) return node;
        let result = history[0];
        for (const event of history) {
          if (event.tick > currentTick.current) break;
          result = event;
        }
        return result;
      }
      return node;
    };

    const screenPoint = (node: { x: number; y: number }) => ({
      x: camera.current.tx + node.x * camera.current.zoom,
      y: camera.current.ty + node.y * camera.current.zoom,
    });

    const pick = (clientX: number, clientY: number): number | null => {
      const rect = canvas.getBoundingClientRect();
      const sx = clientX - rect.left;
      const sy = clientY - rect.top;
      let best: number | null = null;
      let bestDistance = Infinity;
      if (mode.current === 'chronology' && chronology.current) {
        for (const event of chronology.current.events) {
          const node = nodes.current[event.node];
          if (!node || !isShown(node) || event.tick > currentTick.current) continue;
          const point = screenPoint(event);
          const distance = (point.x - sx) ** 2 + (point.y - sy) ** 2;
          const radius = Math.max(7, node.r * camera.current.zoom * 0.72 + 4);
          if (distance <= radius * radius && distance < bestDistance) {
            best = node.id;
            bestDistance = distance;
          }
        }
      } else {
        for (const node of nodes.current) {
          if (!isShown(node)) continue;
          const point = screenPoint(node);
          const distance = (point.x - sx) ** 2 + (point.y - sy) ** 2;
          const radius = Math.max(8, node.r * camera.current.zoom + 5);
          if (distance <= radius * radius && distance < bestDistance) {
            best = node.id;
            bestDistance = distance;
          }
        }
      }
      return best;
    };

    const draw = () => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      const cam = camera.current;
      const zoom = cam.zoom;
      const list = nodes.current;
      const activeId = selected.current ?? hover.current;
      const highlighted = matches.current;
      if (!palette.current.kinds.eu) palette.current = readPalette(probeRef.current, stageRef.current, palette.current.dark, palette.current.contrast);
      const { ink, muted, paper, link } = palette.current;
      const labelPaper = paper;
      const roleColor = (kind: string) => palette.current.kinds[kind] || muted;
      const clusterByKind = new Map(clusters.current.map((box) => [box.kind, box]));
      const occupied: LabelRect[] = [];

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = paper;
      ctx.fillRect(0, 0, width, height);
      ctx.save();
      ctx.translate(cam.tx, cam.ty);
      ctx.scale(zoom, zoom);

      // Aggregate links are the honest map overview: each line joins role
      // groups, and its width represents the number of visible relations.
      const aggregates = new Map<string, { a: string; b: string; count: number }>();
      if (mode.current === 'map') {
        for (const edge of edges.current) {
          const source = list[edge.s];
          const target = list[edge.t];
          if (!source || !target || !isShown(source) || !isShown(target)
              || source.kind === target.kind) continue;
          const a = source.kind < target.kind ? source.kind : target.kind;
          const b = source.kind < target.kind ? target.kind : source.kind;
          const key = `${a}|${b}`;
          const group = aggregates.get(key);
          if (group) group.count++;
          else aggregates.set(key, { a, b, count: 1 });
        }
      }

      const aggregateLabels: {
        key: string; route: RoutePoint[]; text: string; count: number;
      }[] = [];
      for (const group of aggregates.values()) {
        const a = clusterByKind.get(group.a);
        const b = clusterByKind.get(group.b);
        if (!a || !b) continue;
        const routeKey = `${group.a}|${group.b}`;
        let route = aggregateRoutes.current.get(routeKey);
        if (!route) {
          route = routeClusterConnection(clusters.current, a, b).points;
          aggregateRoutes.current.set(routeKey, route);
        }
        const start = route[0];
        const end = route[route.length - 1];
        // A neutral line between two groups (lines, not colour, carry the
        // structure); its weight grows with the count written on it.
        void start; void end;
        ctx.beginPath();
        traceRoundedRoute(ctx, route);
        ctx.strokeStyle = muted;
        ctx.globalAlpha = activeId == null ? 0.55 : 0.12;
        ctx.lineWidth = (0.8 + Math.log2(group.count + 1) * 0.28) / zoom;
        ctx.stroke();
        aggregateLabels.push({
          key: routeKey, route, text: String(group.count), count: group.count,
        });
      }

      if (mode.current === 'map') {
        // Groups: a rule in the kind's colour over each, like a ruled list
        // (DESIGN.md section 5), no filled card. The rule marks the group
        // without turning the rows into an EU/Bund/Bayern chain of command.
        for (const box of clusters.current) {
          if (hiddenKinds.current.has(box.kind)) continue;
          const top = box.y - box.h / 2;
          ctx.beginPath();
          ctx.moveTo(box.x - box.w / 2, top);
          ctx.lineTo(box.x + box.w / 2, top);
          ctx.strokeStyle = roleColor(box.kind);
          ctx.globalAlpha = 1;
          ctx.lineWidth = 1.5 / zoom;
          ctx.stroke();
        }
      } else if (chronology.current) {
        const chrono = chronology.current;
        const laneWidth = chrono.maxX - chrono.minX;
        // Lanes: a rule in the kind's colour over each, no filled band.
        for (const lane of chrono.lanes) {
          if (hiddenKinds.current.has(lane.kind)) continue;
          const top = lane.y - lane.h / 2;
          ctx.beginPath();
          ctx.moveTo(chrono.minX, top);
          ctx.lineTo(chrono.minX + laneWidth, top);
          ctx.strokeStyle = roleColor(lane.kind);
          ctx.globalAlpha = 1;
          ctx.lineWidth = 1.5 / zoom;
          ctx.stroke();
        }

        // Beliefs beyond the current month are valid scheduled/anticipated
        // events, but they are not history yet. A quiet tinted horizon keeps
        // that distinction explicit without removing useful future data.
        const now = new Date();
        const nowTick = now.getUTCFullYear() * 12 + now.getUTCMonth();
        if (chrono.maxTick > nowTick) {
          const futureX = (Math.max(nowTick, chrono.minTick) - chrono.minTick)
            * chrono.monthWidth;
          ctx.fillStyle = alpha(link, 0.05);
          ctx.globalAlpha = 1;
          ctx.fillRect(
            futureX, chrono.minY,
            Math.max(0, chrono.maxX - futureX), chrono.maxY - chrono.minY,
          );
          ctx.beginPath();
          ctx.moveTo(futureX, chrono.minY);
          ctx.lineTo(futureX, chrono.maxY);
          ctx.setLineDash([5 / zoom, 5 / zoom]);
          ctx.strokeStyle = alpha(link, 0.6);
          ctx.lineWidth = 1 / zoom;
          ctx.stroke();
          ctx.setLineDash([]);
        }

        // Calendar-true vertical grid.  The interval adapts to zoom, while X
        // always remains a linear count of months from the first node date.
        const pixelsPerYear = chrono.monthWidth * 12 * zoom;
        const yearStep = pixelsPerYear >= 58 ? 1 : pixelsPerYear >= 25 ? 2 : 5;
        const firstYear = Math.ceil(chrono.minTick / 12);
        const lastYear = Math.floor(chrono.maxTick / 12);
        for (let year = firstYear; year <= lastYear; year += yearStep) {
          const x = (year * 12 - chrono.minTick) * chrono.monthWidth;
          ctx.beginPath();
          ctx.moveTo(x, chrono.minY);
          ctx.lineTo(x, chrono.maxY);
          ctx.strokeStyle = alpha(muted, 0.14);
          ctx.globalAlpha = 1;
          ctx.lineWidth = 1 / zoom;
          ctx.stroke();
        }
        const cutoffX = (currentTick.current - chrono.minTick) * chrono.monthWidth;
        ctx.beginPath();
        ctx.moveTo(cutoffX, chrono.minY);
        ctx.lineTo(cutoffX, chrono.maxY);
        ctx.strokeStyle = link;
        ctx.globalAlpha = 1;
        ctx.lineWidth = 1.5 / zoom;
        ctx.stroke();
      }

      // Node-level relations are intentional only: hover, selection, or the
      // explicit "show all" control. Zoom and search never turn the map into
      // a hairball behind the user's back.
      const neighbors = new Set<number>();
      for (const edge of edges.current) {
        const source = list[edge.s];
        const target = list[edge.t];
        if (!source || !target || !isShown(source) || !isShown(target)) continue;
        const focused = activeId != null && (edge.s === activeId || edge.t === activeId);
        if (!(forceAllEdges.current || focused)) continue;
        const sourcePosition = positionOf(source);
        const targetPosition = positionOf(target);
        const a = screenPoint(sourcePosition);
        const b = screenPoint(targetPosition);
        if ((a.x < -80 && b.x < -80) || (a.x > width + 80 && b.x > width + 80)
            || (a.y < -80 && b.y < -80) || (a.y > height + 80 && b.y > height + 80)) continue;
        if (focused && activeId != null) neighbors.add(edge.s === activeId ? edge.t : edge.s);
        ctx.beginPath();
        ctx.moveTo(sourcePosition.x, sourcePosition.y);
        ctx.lineTo(targetPosition.x, targetPosition.y);
        ctx.strokeStyle = focused ? ink : muted;
        ctx.globalAlpha = focused ? 0.65 : 0.18;
        ctx.lineWidth = (focused ? 1.45 : 0.7) / zoom;
        ctx.stroke();
      }

      // Nodes are culled in screen space.  Search dims non-matches but does
      // not remove context; focus rings stay a constant screen width.
      const drawNodeMarker = (
        node: LayoutNode,
        nodePosition: { x: number; y: number },
        chronologyMarker: boolean,
        inception = false,
      ) => {
        const point = screenPoint(nodePosition);
        if (point.x < -24 || point.x > width + 24 || point.y < -24 || point.y > height + 24) return;
        const dimmed = activeId == null && highlighted != null && !highlighted.has(node.id)
          || activeId != null && node.id !== activeId && !neighbors.has(node.id);
        const nodeRadius = Math.max(chronologyMarker ? Math.max(node.r * 0.72, 1.7 / zoom) : node.r,
          node.id === activeId ? 4 / zoom : neighbors.has(node.id) ? 3 / zoom : 0);
        ctx.beginPath();
        if (inception) {
          const radius = nodeRadius * 1.35;
          ctx.moveTo(nodePosition.x, nodePosition.y - radius);
          ctx.lineTo(nodePosition.x + radius, nodePosition.y);
          ctx.lineTo(nodePosition.x, nodePosition.y + radius);
          ctx.lineTo(nodePosition.x - radius, nodePosition.y);
          ctx.closePath();
        } else {
          ctx.arc(nodePosition.x, nodePosition.y, nodeRadius, 0, Math.PI * 2);
        }
        ctx.fillStyle = roleColor(node.kind);
        ctx.globalAlpha = dimmed ? 0.2 : 0.95;
        ctx.fill();
        if (node.id === activeId || node.id === selected.current) {
          ctx.strokeStyle = ink;
          ctx.globalAlpha = 1;
          ctx.lineWidth = 2 / zoom;
          ctx.stroke();
        } else if (neighbors.has(node.id) || highlighted?.has(node.id)) {
          ctx.strokeStyle = ink;
          ctx.globalAlpha = 1;
          ctx.lineWidth = 1 / zoom;
          ctx.stroke();
        }
      };
      if (mode.current === 'chronology' && chronology.current) {
        for (const event of chronology.current.events) {
          const node = list[event.node];
          if (!node || !isShown(node) || event.tick > currentTick.current) continue;
          drawNodeMarker(node, event, true, Boolean(event.inception));
        }
      } else {
        for (const node of list) {
          if (!isShown(node)) continue;
          drawNodeMarker(node, node, false);
        }
      }
      ctx.restore();
      ctx.globalAlpha = 1;

      // Screen-space cluster headings and aggregate counts stay readable at
      // every zoom and reserve their rectangles before node labels.
      ctx.font = `${width < 640 ? '500 11px' : '500 13px'} ${SANS}`;
      ctx.textBaseline = 'middle';
      const roleHeadings = mode.current === 'chronology' && chronology.current
        ? chronology.current.lanes.map((lane) => ({
            kind: lane.kind,
            center: 0,
            x: Math.max(9, cam.tx + chronology.current!.minX * zoom),
            y: cam.ty + (lane.y - lane.h / 2) * zoom + 12,
          }))
        : clusters.current.map((box) => ({
            kind: box.kind,
            center: cam.tx + box.x * zoom,
            x: cam.tx + (box.x - box.w / 2) * zoom,
            y: cam.ty + (box.y - box.h / 2) * zoom - 12,
          }));
      for (const heading of roleHeadings) {
        if (hiddenKinds.current.has(heading.kind)) continue;
        const count = mode.current === 'chronology' && chronology.current
          ? chronology.current.events.filter((event) => {
              const node = list[event.node];
              return node?.kind === heading.kind && isShown(node)
                && event.tick <= currentTick.current;
            }).length
          : list.filter((node) => node.kind === heading.kind && isShown(node)).length;
        const meta = KIND_META[heading.kind];
        const name = width < 640 ? graphShortKind(heading.kind, i18n.language) : t(meta?.labelKey ?? heading.kind, { defaultValue: meta?.fallback ?? heading.kind });
        const nameWidth = ctx.measureText(`${name}  `).width;
        const sansFont = ctx.font;
        ctx.font = `400 ${width < 640 ? 10 : 12}px ${MONO}`;
        const countWidth = ctx.measureText(String(count)).width;
        ctx.font = sansFont;
        const label = name;
        const textWidth = nameWidth + countWidth;
        if (width < 640 && mode.current === 'map') heading.x = clamp(heading.center - textWidth / 2, 6, width - textWidth - 6);
        if (heading.x + textWidth < 0 || heading.x > width || heading.y < 0 || heading.y > height) continue;
        const rect = {
          left: heading.x - 5, top: heading.y - 9,
          right: heading.x + textWidth + 5, bottom: heading.y + 9,
        };
        if (occupied.some(used => overlaps(rect, used))) continue;
        occupied.push(rect);
        ctx.fillStyle = labelPaper;
        ctx.fillRect(rect.left, rect.top, rect.right - rect.left, rect.bottom - rect.top);
        ctx.fillStyle = roleColor(heading.kind);
        ctx.fillText(label, heading.x, heading.y);
        // the count is data: the mono face, muted
        ctx.font = `400 ${width < 640 ? 10 : 12}px ${MONO}`;
        ctx.fillStyle = muted;
        ctx.fillText(String(count), heading.x + nameWidth, heading.y);
        ctx.font = sansFont;
      }

      if (mode.current === 'chronology' && chronology.current) {
        const chrono = chronology.current;
        const pixelsPerYear = chrono.monthWidth * 12 * zoom;
        const yearStep = pixelsPerYear >= 58 ? 1 : pixelsPerYear >= 25 ? 2 : 5;
        const firstYear = Math.ceil(chrono.minTick / 12);
        const lastYear = Math.floor(chrono.maxTick / 12);
        ctx.font = `400 11px ${MONO}`;
        ctx.textAlign = 'center';
        for (let year = firstYear; year <= lastYear; year += yearStep) {
          const worldX = (year * 12 - chrono.minTick) * chrono.monthWidth;
          const x = cam.tx + worldX * zoom;
          if (x < 16 || x > width - 16) continue;
          const text = String(year);
          const tw = ctx.measureText(text).width;
          const rect = { left: x - tw / 2 - 4, top: 45, right: x + tw / 2 + 4, bottom: 61 };
          if (occupied.some((used) => overlaps(rect, used))) continue;
          occupied.push(rect);
          ctx.fillStyle = labelPaper;
          ctx.fillRect(rect.left, rect.top, rect.right - rect.left, rect.bottom - rect.top);
          ctx.fillStyle = ink;
          ctx.fillText(text, x, 53);
        }
        if (chrono.monthWidth * zoom >= 42) {
          ctx.font = `400 10px ${MONO}`;
          for (let monthTick = chrono.minTick; monthTick <= chrono.maxTick; monthTick++) {
            const x = cam.tx + (monthTick - chrono.minTick) * chrono.monthWidth * zoom;
            if (x < 28 || x > width - 28) continue;
            const year = Math.floor(monthTick / 12);
            const month = monthTick % 12 + 1;
            const text = `${String(month).padStart(2, '0')}.${year}`;
            const tw = ctx.measureText(text).width;
            const rect = { left: x - tw / 2 - 3, top: 63, right: x + tw / 2 + 3, bottom: 77 };
            if (occupied.some((used) => overlaps(rect, used))) continue;
            occupied.push(rect);
            ctx.fillStyle = labelPaper;
            ctx.fillRect(rect.left, rect.top, rect.right - rect.left, rect.bottom - rect.top);
            ctx.fillStyle = muted;
            ctx.fillText(text, x, 70);
          }
        }

        // Full-history density overview.  The outlined window is the portion
        // currently in the camera; it makes the sparse 1985–2023 span and the
        // dense 2025–2026 tail legible without distorting calendar distance.
        const mini = { left: 12, right: Math.max(90, width - 64), top: height - 50, bottom: height - 12 };
        const miniW = mini.right - mini.left;
        const monthCount = chrono.maxTick - chrono.minTick + 1;
        const totals = new Uint16Array(monthCount);
        const revealed = new Uint16Array(monthCount);
        for (const event of chrono.events) {
          const node = list[event.node];
          if (!node) continue;
          if (hiddenKinds.current.has(node.kind)) continue;
          const index = event.tick - chrono.minTick;
          if (index < 0 || index >= monthCount) continue;
          totals[index]++;
          if (event.tick <= currentTick.current) revealed[index]++;
        }
        const maxDensity = Math.max(1, ...totals);
        ctx.fillStyle = labelPaper;
        ctx.fillRect(mini.left - 1, mini.top - 1, miniW + 2, mini.bottom - mini.top + 2);
        for (let index = 0; index < monthCount; index++) {
          if (!totals[index]) continue;
          const x0 = mini.left + index / monthCount * miniW;
          const x1 = mini.left + (index + 1) / monthCount * miniW;
          const barH = Math.max(1, totals[index] / maxDensity * (mini.bottom - mini.top - 5));
          ctx.fillStyle = revealed[index] === totals[index] ? alpha(link, 0.8) : alpha(link, 0.28);
          ctx.fillRect(x0, mini.bottom - barH, Math.max(1, x1 - x0), barH);
        }
        const visibleWorldLeft = clamp((-cam.tx) / zoom, chrono.minX, chrono.maxX);
        const visibleWorldRight = clamp((width - cam.tx) / zoom, chrono.minX, chrono.maxX);
        const range = Math.max(1, chrono.maxX - chrono.minX);
        const viewLeft = mini.left + (visibleWorldLeft - chrono.minX) / range * miniW;
        const viewRight = mini.left + (visibleWorldRight - chrono.minX) / range * miniW;
        ctx.strokeStyle = ink;
        ctx.lineWidth = 1;
        ctx.strokeRect(viewLeft, mini.top, Math.max(2, viewRight - viewLeft), mini.bottom - mini.top);
        occupied.push({ left: mini.left - 2, top: mini.top - 2, right: mini.right + 2, bottom: mini.bottom + 2 });
        ctx.textAlign = 'left';
      }

      if (mode.current === 'map' && zoom < 0.86) {
        ctx.font = `400 11px ${MONO}`;
        ctx.textAlign = 'center';
        const fractions = [.5, .4, .6, .3, .7];
        for (const label of aggregateLabels
          .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key))) {
          const tw = ctx.measureText(label.text).width;
          let point: { x: number; y: number } | null = null;
          let rect: LabelRect | null = null;
          for (const fraction of fractions) {
            const world = routePointAt(label.route, fraction);
            const candidate = {
              x: cam.tx + world.x * zoom,
              y: cam.ty + world.y * zoom,
            };
            const candidateRect = {
              left: candidate.x - tw / 2 - 4,
              top: candidate.y - 7,
              right: candidate.x + tw / 2 + 4,
              bottom: candidate.y + 7,
            };
            if (candidateRect.left < 3 || candidateRect.right > width - 3
                || candidateRect.top < 3 || candidateRect.bottom > height - 3
                || occupied.some((used) => overlaps(candidateRect, used))) continue;
            point = candidate;
            rect = candidateRect;
            break;
          }
          // Stronger counts reserve the cleanest locations. If every candidate
          // collides, hiding a low-priority count is calmer than stacking it.
          if (!point || !rect) continue;
          occupied.push(rect);
          ctx.fillStyle = labelPaper;
          ctx.fillRect(rect.left, rect.top, rect.right - rect.left, rect.bottom - rect.top);
          ctx.fillStyle = muted;
          ctx.fillText(label.text, point.x, point.y);
        }
        ctx.textAlign = 'left';
      }

      // Collision-safe node labels.  Priority is focus, search, then hubs and
      // high-degree nodes; a bounded label budget prevents text walls.
      const labelBudget = Math.min(72, Math.max(12, Math.floor(width * height / 17000)))
        + (zoom > 1.7 ? 20 : 0);
      const candidates = list
        .filter((node) => {
          if (!isShown(node)) return false;
          const point = screenPoint(positionOf(node));
          if (point.x < 0 || point.x > width || point.y < 0 || point.y > height) return false;
          return node.id === activeId || node.id === selected.current
            || neighbors.has(node.id)
            || highlighted?.has(node.id)
            || (zoom >= 0.9 && (node.kind === 'hub' || node.deg >= 8))
            || (zoom >= 1.8 && node.deg >= 2);
        })
        .sort((a, b) => {
          const priority = (node: LayoutNode) =>
            (node.id === activeId ? 10000 : 0)
            + (node.id === selected.current ? 8000 : 0)
            + (highlighted?.has(node.id) ? 5000 : 0)
            + (node.kind === 'hub' ? 800 : 0) + node.deg;
          return priority(b) - priority(a) || a.label.localeCompare(b.label);
        });

      ctx.font = `400 12px ${SANS}`;
      ctx.textBaseline = 'middle';
      let labelsDrawn = 0;
      for (const node of candidates) {
        if (labelsDrawn >= labelBudget && node.id !== activeId) break;
        const point = screenPoint(positionOf(node));
        const maxChars = node.id === activeId ? 48 : zoom > 1.7 ? 34 : 25;
        const label = nodeLabels.current[node.id] ?? node.label;
        const text = label.length > maxChars
          ? `${label.slice(0, maxChars - 1)}…` : label;
        const textWidth = ctx.measureText(text).width;
        const radius = Math.max(4, node.r * zoom);
        const placements = [
          { x: point.x + radius + 6, y: point.y, side: 'right' },
          { x: point.x - radius - 6 - textWidth, y: point.y, side: 'left' },
          { x: point.x - textWidth / 2, y: point.y - radius - 10, side: 'top' },
          { x: point.x - textWidth / 2, y: point.y + radius + 10, side: 'bottom' },
        ];
        let placement: typeof placements[number] | undefined;
        let rect: LabelRect | undefined;
        for (const option of placements) {
          const candidate = {
            left: option.x - 4, top: option.y - 9,
            right: option.x + textWidth + 4, bottom: option.y + 9,
          };
          if (candidate.left < 3 || candidate.right > width - 3
              || candidate.top < 3 || candidate.bottom > height - 3) continue;
          if (!occupied.some((used) => overlaps(candidate, used))) {
            placement = option;
            rect = candidate;
            break;
          }
        }
        if (!placement || !rect) continue;
        occupied.push(rect);
        ctx.fillStyle = labelPaper;
        ctx.fillRect(rect.left, rect.top, rect.right - rect.left, rect.bottom - rect.top);
        ctx.fillStyle = node.id === activeId ? ink : muted;
        ctx.fillText(text, placement.x, placement.y);
        labelsDrawn++;
      }
    };

    const frame = (now: number) => {
      scheduled = false;
      const animation = cameraAnimation.current;
      if (animation) {
        const progress = Math.min(1, (now - animation.start) / animation.duration);
        const eased = 1 - (1 - progress) ** 3;
        camera.current.tx = animation.from.tx + (animation.to.tx - animation.from.tx) * eased;
        camera.current.ty = animation.from.ty + (animation.to.ty - animation.from.ty) * eased;
        camera.current.zoom = animation.from.zoom + (animation.to.zoom - animation.from.zoom) * eased;
        if (progress >= 1) cameraAnimation.current = null;
      }
      draw();
      if (cameraAnimation.current) requestDraw();
    };

    const requestDraw = () => {
      if (scheduled) return;
      scheduled = true;
      raf = requestAnimationFrame(frame);
    };
    invalidate.current = requestDraw;

    const resize = () => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      // A hidden workbench panel must not reset its saved viewport to 0x0.
      if (!width || !height) return;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      const { width: oldW, height: oldH } = viewport.current;
      if (oldW === 0 && !hasFramed.current) {
        camera.current.tx = width / 2;
        camera.current.ty = height / 2;
      } else if (oldW !== 0) {
        camera.current.tx += (width - oldW) / 2;
        camera.current.ty += (height - oldH) / 2;
      }
      viewport.current = { width, height };
      requestDraw();
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    const pointers = new Map<number, { x: number; y: number }>();
    const gesture = { id: -1, x: 0, y: 0, moved: false, node: null as number | null };
    const pan = { active: false, x: 0, y: 0 };
    let pinchDistance = 0;
    let overviewPanning = false;
    const pinchMiddle = { x: 0, y: 0 };

    const panFromOverview = (clientX: number) => {
      const chrono = chronology.current;
      if (!chrono) return;
      const rect = canvas.getBoundingClientRect();
      const localX = clientX - rect.left;
      const left = 12;
      const right = Math.max(90, canvas.clientWidth - 64);
      const ratio = clamp((localX - left) / Math.max(1, right - left), 0, 1);
      const worldX = chrono.minX + ratio * (chrono.maxX - chrono.minX);
      camera.current.tx = canvas.clientWidth / 2 - worldX * camera.current.zoom;
      cameraAnimation.current = null;
      requestDraw();
    };

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const sx = event.clientX - rect.left;
      const sy = event.clientY - rect.top;
      const base = cameraAnimation.current?.to ?? camera.current;
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? canvas.clientHeight : 1);
      const zoom = clamp(base.zoom * Math.exp(-clamp(delta, -240, 240) * 0.0014), MIN_ZOOM, 5);
      animateCamera({ zoom, tx: sx - (sx - base.tx) / base.zoom * zoom, ty: sy - (sy - base.ty) / base.zoom * zoom }, 140);
    };
    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      cameraAnimation.current = null;
      canvas.setPointerCapture(event.pointerId);
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      const rect = canvas.getBoundingClientRect();
      const localY = event.clientY - rect.top;
      if (mode.current === 'chronology' && localY >= canvas.clientHeight - 56) {
        overviewPanning = true;
        gesture.id = -1;
        panFromOverview(event.clientX);
        return;
      }
      if (pointers.size === 2) {
        const [a, b] = Array.from(pointers.values());
        pinchDistance = Math.hypot(a.x - b.x, a.y - b.y) || 1;
        pinchMiddle.x = (a.x + b.x) / 2;
        pinchMiddle.y = (a.y + b.y) / 2;
        pan.active = false;
        gesture.id = -1;
        return;
      }
      if (pointers.size > 2) return;
      gesture.id = event.pointerId;
      gesture.x = event.clientX;
      gesture.y = event.clientY;
      gesture.moved = false;
      gesture.node = pick(event.clientX, event.clientY);
      pan.active = true;
      pan.x = event.clientX;
      pan.y = event.clientY;
    };
    const onPointerMove = (event: PointerEvent) => {
      const pointer = pointers.get(event.pointerId);
      if (pointer) { pointer.x = event.clientX; pointer.y = event.clientY; }
      if (overviewPanning) {
        panFromOverview(event.clientX);
        return;
      }
      if (gesture.id === event.pointerId && !gesture.moved
          && Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > 5) {
        gesture.moved = true;
      }
      if (pinchDistance > 0 && pointers.size === 2) {
        const [a, b] = Array.from(pointers.values());
        const distance = Math.hypot(a.x - b.x, a.y - b.y) || 1;
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2;
        camera.current.tx += mx - pinchMiddle.x;
        camera.current.ty += my - pinchMiddle.y;
        const rect = canvas.getBoundingClientRect();
        zoomAt(mx - rect.left, my - rect.top, distance / pinchDistance);
        pinchDistance = distance;
        pinchMiddle.x = mx;
        pinchMiddle.y = my;
        return;
      }
      if (pan.active) {
        camera.current.tx += event.clientX - pan.x;
        camera.current.ty += event.clientY - pan.y;
        pan.x = event.clientX;
        pan.y = event.clientY;
        requestDraw();
        return;
      }
      if (event.pointerType === 'touch' || pointers.size > 0) return;
      const id = pick(event.clientX, event.clientY);
      if (id !== hover.current) {
        hover.current = id;
        requestDraw();
      }
    };
    const finishPointer = (event: PointerEvent) => {
      pointers.delete(event.pointerId);
      if (overviewPanning) {
        overviewPanning = false;
        return;
      }
      if (pinchDistance > 0) {
        if (pointers.size < 2) pinchDistance = 0;
        if (pointers.size === 1) {
          const [remaining] = Array.from(pointers.values());
          pan.active = true;
          pan.x = remaining.x;
          pan.y = remaining.y;
        }
        return;
      }
      if (event.type !== 'pointercancel' && gesture.id === event.pointerId && !gesture.moved) {
        const id = gesture.node ?? pick(event.clientX, event.clientY);
        selected.current = selected.current === id ? null : id;
        setInspectedId(selected.current);
        if (selected.current != null) setListOpen(true);
        requestDraw();
      }
      gesture.id = -1;
      pan.active = false;
    };
    const onPointerLeave = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return;
      if (hover.current != null) {
        hover.current = null;
        requestDraw();
      }
    };

    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', finishPointer);
    canvas.addEventListener('pointercancel', finishPointer);
    canvas.addEventListener('pointerleave', onPointerLeave);
    requestDraw();

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      invalidate.current = () => undefined;
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', finishPointer);
      canvas.removeEventListener('pointercancel', finishPointer);
      canvas.removeEventListener('pointerleave', onPointerLeave);
    };
  }, [t, i18n.language, zoomAt, animateCamera, stacked]);

  const toggleKind = (kind: string) => setOffKinds((previous) => {
    const next = new Set(previous);
    if (next.has(kind)) next.delete(kind); else next.add(kind);
    return next;
  });

  const zoomFromCenter = (factor: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const sx = canvas.clientWidth / 2;
    const sy = canvas.clientHeight / 2;
    const base = cameraAnimation.current?.to ?? camera.current;
    const wx = (sx - base.tx) / base.zoom;
    const wy = (sy - base.ty) / base.zoom;
    const zoom = clamp(base.zoom * factor, MIN_ZOOM, 5);
    animateCamera({ zoom, tx: sx - wx * zoom, ty: sy - wy * zoom }, 220);
  };

  const frameRecentChronology = useCallback(() => {
    const canvas = canvasRef.current;
    const chrono = chronology.current;
    if (!canvas || !chrono) return;
    const shownLanes = chrono.lanes.filter((lane) => !hiddenKinds.current.has(lane.kind));
    if (!shownLanes.length) return;
    const recentMonths = 48;
    const startTick = Math.max(chrono.minTick, chrono.maxTick - recentMonths);
    const minX = (startTick - chrono.minTick) * chrono.monthWidth - 32;
    const maxX = chrono.maxX;
    const minY = Math.min(...shownLanes.map((lane) => lane.y - lane.h / 2));
    const maxY = Math.max(...shownLanes.map((lane) => lane.y + lane.h / 2));
    const pad = canvas.clientWidth < 640 ? 28 : 48;
    const zoom = clamp(Math.min(
      (canvas.clientWidth - pad * 2) / Math.max(1, maxX - minX),
      (canvas.clientHeight - pad * 2) / Math.max(1, maxY - minY),
    ), MIN_ZOOM, 5);
    animateCamera({
      zoom,
      tx: canvas.clientWidth / 2 - ((minX + maxX) / 2) * zoom,
      ty: canvas.clientHeight / 2 - ((minY + maxY) / 2) * zoom,
    }, 320);
  }, [animateCamera]);

  const switchView = (next: 'map' | 'chronology') => {
    if (next === mode.current) return;
    savedCameras.current[mode.current] = { ...camera.current };
    mode.current = next;
    setViewMode(next);
    const saved = savedCameras.current[next];
    if (next === 'chronology' && playing) {
      requestAnimationFrame(() => followChronologyTick(currentTick.current, 360));
    } else if (saved) {
      animateCamera(saved, 360);
    } else {
      requestAnimationFrame(() => {
        if (next === 'chronology') frameRecentChronology(); else fitToView();
      });
    }
  };

  // The site's date forms: a month MM.YYYY, a day DD.MM.YYYY (core/formatDay.ts).
  const rawLabel = data ? data.tick_labels[data.ticks[tick]] ?? '' : '';
  const currentLabel = !rawLabel ? '—' : /^\d{4}-\d{2}$/.test(rawLabel) ? `${rawLabel.slice(5)}.${rawLabel.slice(0, 4)}` : formatDay(rawLabel);
  const shownNodes = data ? nodes.current.filter((node) =>
    visible(node, offKinds, data.ticks[tick] ?? Infinity)).length : 0;
  const shownEvents = data && chronology.current
    ? chronology.current.events.filter((event) => {
        const node = nodes.current[event.node];
        return node && visible(node, offKinds, data.ticks[tick] ?? Infinity)
          && event.tick <= (data.ticks[tick] ?? Infinity);
      }).length
    : 0;
  const inspected = inspectedId == null ? null : nodes.current[inspectedId];

  const resultIds = useMemo(() => graphMatches(data?.nodes ?? [], search, offKinds, data?.ticks[tick] ?? Infinity, labels)
    .sort((a, b) => {
      const left = nodes.current[a], right = nodes.current[b];
      const law = (kind: string) => ['fed-act', 'by-act', 'eu'].includes(kind) ? 1 : 0;
      return law(right.kind) - law(left.kind) || right.deg - left.deg || left.label.localeCompare(right.label);
    }), [data, search, offKinds, tick, labels]);
  const connections = inspected ? graphConnections(data?.nodes ?? [], edges.current, inspected.id, offKinds, data?.ticks[tick] ?? Infinity) : [];
  const actId = inspected ? graphActId(inspected, acts) : null;
  const clearSelection = () => { selected.current = null; hover.current = null; setInspectedId(null); invalidate.current(); };
  const focusNode = (id: number) => {
    const node = nodes.current[id];
    const canvas = canvasRef.current;
    if (!node || !canvas) return;
    selected.current = id;
    hover.current = null;
    setInspectedId(id);
    setListOpen(true);
    const ids = new Set([id, ...graphConnections(nodes.current, edges.current, id, offKinds, currentTick.current).map(row => row.nodeId)]);
    const points = Array.from(ids).map(nodeId => {
      const history = chronology.current?.eventsByNode[nodeId]?.filter(event => event.tick <= currentTick.current);
      return mode.current === 'chronology' && history?.length ? history[history.length - 1] : nodes.current[nodeId];
    });
    const minX = Math.min(...points.map(point => point.x)), maxX = Math.max(...points.map(point => point.x));
    const minY = Math.min(...points.map(point => point.y)), maxY = Math.max(...points.map(point => point.y));
    const zoom = clamp(Math.min((canvas.clientWidth - 100) / Math.max(120, maxX - minX), (canvas.clientHeight - 100) / Math.max(120, maxY - minY)), MIN_ZOOM, 1.8);
    animateCamera({ zoom, tx: canvas.clientWidth / 2 - (minX + maxX) / 2 * zoom, ty: canvas.clientHeight / 2 - (minY + maxY) / 2 * zoom }, 420);
  };
  const kindLabel = (kind: string) => t(KIND_META[kind]?.labelKey ?? kind, { defaultValue: KIND_META[kind]?.fallback ?? kind });

  const stage = (
    <div ref={stageRef} className={styles.stage}>
      <span ref={probeRef} hidden aria-hidden="true" />
      <canvas ref={canvasRef} className={styles.canvas} tabIndex={0}
        aria-label={t('graph.canvasLabel', { defaultValue: 'Interactive clustered legislative graph' })}
        onKeyDown={event => {
          if (event.key === 'Escape') { clearSelection(); return; }
          if (event.key === '+' || event.key === '=') { event.preventDefault(); zoomFromCenter(1.3); }
          if (event.key === '-') { event.preventDefault(); zoomFromCenter(1 / 1.3); }
          const direction = ({ ArrowLeft: [60, 0], ArrowRight: [-60, 0], ArrowUp: [0, 60], ArrowDown: [0, -60] } as Record<string, number[]>)[event.key];
          if (direction) { event.preventDefault(); const base = cameraAnimation.current?.to ?? camera.current; animateCamera({ ...base, tx: base.tx + direction[0], ty: base.ty + direction[1] }, 160); }
        }} />
      <div className={styles.stats}>{viewMode === 'chronology' ? shownEvents : shownNodes} {viewMode === 'chronology' ? t('graph.eventsShort', { defaultValue: 'events' }) : t('graph.nodesShort', { defaultValue: 'nodes' })}</div>
      {/* A named switch: the crossed-out eye did not say what it hid. */}
      <button className={`${styles.textTool} ${styles.edgeToggle}`} type="button" aria-pressed={showAllEdges} onClick={() => setShowAllEdges(!showAllEdges)}>{capitalize(t('graph.edgesAll', { defaultValue: 'all relations' }))}</button>
      <div className={styles.zoom}>
        <button className={styles.tool} type="button" title={t('graph.zoomIn')} aria-label={t('graph.zoomIn')} onClick={() => zoomFromCenter(1.3)}><Plus size={18} /></button>
        <button className={styles.tool} type="button" title={t('graph.zoomOut')} aria-label={t('graph.zoomOut')} onClick={() => zoomFromCenter(1 / 1.3)}><Minus size={18} /></button>
        <button className={styles.tool} type="button" title={t('graph.fit')} aria-label={t('graph.fit')} onClick={fitToView}><Focus size={17} /></button>
      </div>
      {loading && <div className={styles.empty} role="status"><Loader2 size={20} className="animate-spin" />{t('graph.loading')}</div>}
      {error && !loading && <div className={styles.empty} role="alert"><TriangleAlert size={20} />{t('graph.error')}<button className={styles.action} onClick={() => setAttempt(value => value + 1)}><RotateCcw size={14} />{copy.retry}</button></div>}
    </div>
  );
  const documents = (
    <aside className={styles.sidebar} aria-label={inspected ? copy.connections : copy.browse}>
      <div className={`sntiq-search ${styles.search}`}>
        <Search size={15} aria-hidden="true" />
        <input className="sntiq-field sntiq-field-sm" aria-label={copy.search} placeholder={copy.search} value={search} onChange={event => { setSearch(event.target.value); clearSelection(); }} />
        {search && <button className={styles.tool} aria-label={copy.clearSearch} title={copy.clearSearch} onClick={() => { setSearch(''); clearSelection(); }}><X size={14} /></button>}
      </div>
      {inspected ? <>
        <div className={styles.inspector} key={inspected.id}>
          <button className={styles.link} onClick={clearSelection}><ArrowLeft size={14} />{copy.back}</button>
          <small>{kindLabel(inspected.kind)}</small>
          <h2>{labels[inspected.id] ?? inspected.label}</h2>
          {actId && onOpenAct && <button className={styles.action} onClick={() => onOpenAct(actId)}>{copy.open}<ArrowRight size={14} aria-hidden="true" /></button>}
        </div>
        <div className={styles.listHeading}><span>{copy.connections}</span><span>{connections.length}</span></div>
        <div className={styles.list} key={`relations:${inspected.id}`}>
          {connections.slice(0, resultLimit).map(row => <button key={`${row.nodeId}:${row.relation}:${row.outgoing}`} className={styles.result} onClick={() => focusNode(row.nodeId)}>
            <span className={styles.relation} data-uncertain={row.relation === 20} title={row.outgoing ? copy.outgoing : copy.incoming}>{row.outgoing ? <ArrowRight size={12} /> : <ArrowLeft size={12} />}{copy.relations[row.relation as keyof typeof copy.relations] ?? copy.connections}</span>
            <strong>{labels[row.nodeId] ?? nodes.current[row.nodeId].label}</strong>
            <small>{kindLabel(nodes.current[row.nodeId].kind)}</small>
          </button>)}
          {!connections.length && <p className={styles.emptyList}>{copy.noConnections}</p>}
          {connections.length > resultLimit && <button className={styles.more} onClick={() => setResultLimit(value => value + 60)}>{copy.more}</button>}
        </div>
      </> : <>
        <div className={styles.listHeading}><span>{copy.browse}</span><span>{resultIds.length}</span></div>
        <div className={styles.list}>
          {resultIds.slice(0, resultLimit).map(id => <button className={styles.result} key={id} data-graph-node={id} onClick={() => focusNode(id)}>
            <strong><span className={styles.swatch} style={{ background: kindVar(nodes.current[id].kind) }} />{labels[id] ?? nodes.current[id].label}</strong>
            <small>{kindLabel(nodes.current[id].kind)}<span title={copy.connections}>{nodes.current[id].deg}</span></small>
          </button>)}
          {!resultIds.length && !loading && <p className={styles.emptyList}>{copy.empty}</p>}
          {resultIds.length > resultLimit && <button className={styles.more} onClick={() => setResultLimit(value => value + 60)}>{copy.more}</button>}
        </div>
      </>}
    </aside>
  );

  return (
    <section className={`${styles.graph} ${className}`} data-graph-explorer>
      <header className={styles.toolbar}>
        <div className={styles.modes}>
          <button type="button" aria-pressed={viewMode === 'map'} onClick={() => switchView('map')}>{t('graph.viewMap', { defaultValue: 'Map' })}</button>
          <button type="button" aria-pressed={viewMode === 'chronology'} onClick={() => switchView('chronology')}>{t('graph.viewChronology', { defaultValue: 'Chronology' })}</button>
        </div>
        <span className={styles.spacer} />
        {viewMode === 'chronology' && <button className={styles.recent} onClick={frameRecentChronology}>{t('graph.recentWindow', { defaultValue: 'Recent 4 years' })}</button>}
        {/* Words, not glyphs: a sliders icon and a list icon said nothing to a
            first-time visitor. */}
        <button ref={filtersButton} className={styles.textTool} type="button" aria-controls={filtersOpen ? 'kerf-graph-filters' : undefined} aria-expanded={filtersOpen} onClick={() => setFiltersOpen(!filtersOpen)}>{copy.filters}{offKinds.size > 0 && <span className={styles.filterCount}>{KIND_ORDER.filter(kind => data?.nodes.some(node => node.kind === kind)).length - offKinds.size}</span>}</button>
        <button className={styles.textTool} type="button" aria-pressed={listOpen} onClick={() => setListOpen(!listOpen)}>{copy.browse}</button>
      </header>
      {filtersOpen && <div ref={filtersRef} id="kerf-graph-filters" role="group" aria-label={copy.filters} className={styles.filters}>
        {KIND_ORDER.filter(kind => data?.nodes.some(node => node.kind === kind)).map(kind => <label key={kind}>
          <input type="checkbox" className="sntiq-check" checked={!offKinds.has(kind)} onChange={() => toggleKind(kind)} />
          <span className={styles.swatch} style={{ background: kindVar(kind) }} />{kindLabel(kind)}
        </label>)}
        {offKinds.size > 0 && <button className={styles.link} onClick={() => setOffKinds(new Set())}>{copy.reset}</button>}
      </div>}
      <SplitPanes
        id="kerf-graph-documents"
        className={styles.body}
        orientation={stacked ? 'vertical' : 'horizontal'}
        mode={listOpen ? 'split' : stacked ? 'first' : 'second'}
        label={copy.resize}
        defaultSize={stacked ? '57%' : '290px'}
        minSize={stacked ? '28%' : '190px'}
        maxSize={stacked ? '72%' : '56%'}
        secondMinSize={stacked ? '28%' : '40%'}
        first={stacked ? stage : documents}
        second={stacked ? documents : stage}
      />
      {data && <footer className={styles.timeline}>
        <button className={styles.tool} type="button" aria-label={playing ? t('graph.pause') : t('graph.play')} title={playing ? t('graph.pause') : t('graph.play')} onClick={() => setPlaying(!playing)}>{playing ? <Pause size={16} /> : <Play size={16} />}</button>
        <label htmlFor="kerf-graph-time">{copy.date}</label>
        <input id="kerf-graph-time" type="range" className="sntiq-range" min={0} max={Math.max(0, data.ticks.length - 1)} value={tick} aria-valuetext={currentLabel} onChange={event => { setPlaying(false); setTick(Number(event.target.value)); }} />
        <output htmlFor="kerf-graph-time">{currentLabel}</output>
      </footer>}
    </section>
  );
};

export default KerfArenaGraph;
