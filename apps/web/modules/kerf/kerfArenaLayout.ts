/**
 * Deterministic, role-based layout for the Kerf arena.
 *
 * The source graph mixes legal instruments, parliamentary procedures,
 * actors, topics and publication evidence.  Putting all of them into one
 * force simulation makes proximity look meaningful when it is not and makes
 * the picture move between visits.  These clusters are visual facets, not a
 * legal hierarchy.  Nodes are placed on a collision-free, centre-out grid so
 * the same payload always produces the same map.
 */

export interface KerfNode {
  label: string;
  trust: number;
  kind: string;
  born: number;
}

export interface KerfEdge { s: number; t: number; r: number; d: number; }
export interface KerfBelief { n: number; b: number; pT: number; pF: number; pN: number; }

export interface LayoutNode extends KerfNode {
  id: number;
  x: number;
  y: number;
  deg: number;
  r: number;
}

export interface ClusterBox {
  kind: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface RoutePoint { x: number; y: number; }
export interface ClusterConnectionRoute {
  points: RoutePoint[];
  sourceKind: string;
  targetKind: string;
}
export interface ClusterConnectionSpec {
  sourceKind: string;
  targetKind: string;
  weight?: number;
}

export interface ChronologyPosition { x: number; y: number; }
export interface ChronologyEvent extends ChronologyPosition {
  node: number;
  tick: number;
  inception?: boolean;
  pT?: number;
  pF?: number;
  pN?: number;
}
export interface ChronologyLane { kind: string; y: number; h: number; }
export interface ChronologyLayout {
  events: ChronologyEvent[];
  eventsByNode: ChronologyEvent[][];
  lanes: ChronologyLane[];
  minTick: number;
  maxTick: number;
  monthWidth: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface ChronologyCamera {
  tx: number;
  ty: number;
  zoom: number;
}

export const KIND_ORDER = [
  'eu', 'fed-act', 'by-act',
  'initiator', 'vorgang', 'topic',
  'land', 'hub', 'by-bill',
] as const;

const monthOrdinal = (year: number, month: number) => year * 12 + month - 1;

/** Historical start of the entity represented by an initiator label.
 *
 * This stays separate from `born` (first appearance in this corpus). Party
 * factions use the formation of today's party; CDU/CSU uses the joint
 * parliamentary group because no single "CDU/CSU party" exists. Länder use
 * the formation or democratic restoration of the modern Land.
 */
const INITIATOR_HISTORICAL_SINCE: Readonly<Record<string, number>> = {
  Bundesregierung: monthOrdinal(1949, 9),
  'Fraktion BÜNDNIS 90/DIE GRÜNEN': monthOrdinal(1993, 5),
  'Fraktion der CDU/CSU': monthOrdinal(1949, 9),
  'Fraktion der SPD': monthOrdinal(1863, 5),
  'Fraktion DIE LINKE': monthOrdinal(2007, 6),
  'Gruppe Die Linke': monthOrdinal(2007, 6),
  'Fraktion der AfD': monthOrdinal(2013, 2),
  'Fraktion der FDP': monthOrdinal(1948, 12),
  'Fraktion der Freien Demokraten': monthOrdinal(1948, 12),
  'Gruppe BSW': monthOrdinal(2024, 1),
  'Bündnis Sahra Wagenknecht': monthOrdinal(2024, 1),
  'Baden-Württemberg': monthOrdinal(1952, 4),
  Bayern: monthOrdinal(1946, 12),
  Berlin: monthOrdinal(1990, 10),
  Brandenburg: monthOrdinal(1990, 10),
  Bremen: monthOrdinal(1947, 1),
  Hamburg: monthOrdinal(1946, 5),
  Hessen: monthOrdinal(1945, 9),
  'Mecklenburg-Vorpommern': monthOrdinal(1990, 10),
  Niedersachsen: monthOrdinal(1946, 11),
  'Nordrhein-Westfalen': monthOrdinal(1946, 8),
  'Rheinland-Pfalz': monthOrdinal(1946, 8),
  Saarland: monthOrdinal(1957, 1),
  Sachsen: monthOrdinal(1990, 10),
  'Sachsen-Anhalt': monthOrdinal(1990, 10),
  'Schleswig-Holstein': monthOrdinal(1946, 8),
  Thüringen: monthOrdinal(1990, 10),
};

export const initiatorHistoricalSince = (label: string) =>
  INITIATOR_HISTORICAL_SINCE[label];

/** Kinds of graph nodes. Their colours are the --g-<kind> tokens in
 *  app/globals.css (DESIGN.md section 3), never set here. */
export const KIND_META: Record<string, {
  labelKey: string;
  fallback: string;
  aspect: number;
  minW: number;
  minH: number;
}> = {
  eu: {
    labelKey: 'graph.cluster.eu', fallback: 'EU instruments',
    aspect: 1.55, minW: 350, minH: 240,
  },
  'fed-act': {
    labelKey: 'graph.cluster.fedAct', fallback: 'Federal acts',
    aspect: 1.65, minW: 390, minH: 240,
  },
  'by-act': {
    labelKey: 'graph.cluster.byAct', fallback: 'Bavarian acts',
    aspect: 1.35, minW: 290, minH: 220,
  },
  initiator: {
    labelKey: 'graph.cluster.initiator', fallback: 'Initiators',
    aspect: 1.25, minW: 300, minH: 250,
  },
  vorgang: {
    labelKey: 'graph.cluster.procedure', fallback: 'Federal procedures',
    aspect: 1.75, minW: 700, minH: 390,
  },
  topic: {
    labelKey: 'graph.cluster.topic', fallback: 'Topics',
    aspect: 1.25, minW: 310, minH: 250,
  },
  land: {
    labelKey: 'graph.cluster.land', fallback: 'Lander monitor',
    aspect: 1.25, minW: 290, minH: 220,
  },
  hub: {
    labelKey: 'graph.cluster.evidence', fallback: 'Process evidence',
    aspect: 1.45, minW: 420, minH: 280,
  },
  'by-bill': {
    labelKey: 'graph.cluster.byBill', fallback: 'Bavarian procedures',
    aspect: 1.7, minW: 520, minH: 310,
  },
};

const ROWS: readonly (readonly string[])[] = [
  ['eu', 'fed-act', 'by-act'],
  ['initiator', 'vorgang', 'topic'],
  ['land', 'hub', 'by-bill'],
];

const GAP_X = 110;
const GAP_Y = 130;
const NODE_AREA = 760;

function clusterSize(kind: string, count: number): { w: number; h: number } {
  const meta = KIND_META[kind] ?? {
    aspect: 1.4, minW: 320, minH: 240,
  };
  const area = Math.max(count * NODE_AREA, meta.minW * meta.minH * 0.72);
  return {
    w: Math.max(meta.minW, Math.sqrt(area * meta.aspect) + 76),
    h: Math.max(meta.minH, Math.sqrt(area / meta.aspect) + 76),
  };
}

/** Build boxes in three independent, centred rows.  No row means rank: the
 * rows merely keep source families, procedures and supporting context apart. */
function buildBoxes(counts: Map<string, number>, narrow: boolean): ClusterBox[] {
  const known = new Set<string>(ROWS.flat());
  const extraKinds = Array.from(counts.keys())
    .filter((kind) => !known.has(kind))
    .sort();
  // A single vertical rail uses the tall phone canvas instead of shrinking a
  // desktop 3x3 board into its upper third. Desktop keeps the compact board.
  const rows: readonly (readonly string[])[] = narrow
    ? [...KIND_ORDER.map((kind) => [kind] as readonly string[]),
       ...extraKinds.map((kind) => [kind] as readonly string[])]
    : extraKinds.length ? [...ROWS, extraKinds] : ROWS;
  const rowLayouts = rows.map((kinds) => {
    const boxes = kinds
      .filter((kind) => (counts.get(kind) ?? 0) > 0)
      .map((kind) => ({ kind, ...clusterSize(kind, counts.get(kind) ?? 0) }));
    return {
      boxes,
      w: boxes.reduce((sum, box) => sum + box.w, 0)
        + Math.max(0, boxes.length - 1) * GAP_X,
      h: Math.max(0, ...boxes.map((box) => box.h)),
    };
  });
  const totalH = rowLayouts.reduce((sum, row) => sum + row.h, 0)
    + Math.max(0, rowLayouts.filter((row) => row.h > 0).length - 1) * GAP_Y;
  let top = -totalH / 2;
  const result: ClusterBox[] = [];
  for (const row of rowLayouts) {
    if (!row.boxes.length) continue;
    let left = -row.w / 2;
    for (const box of row.boxes) {
      result.push({
        kind: box.kind,
        x: left + box.w / 2,
        y: top + row.h / 2,
        w: box.w,
        h: box.h,
      });
      left += box.w + GAP_X;
    }
    top += row.h + GAP_Y;
  }
  return result;
}

/** Grid cells sorted from the centre out.  High-degree nodes are assigned
 * first and therefore remain easy to reach without pushing other labels on
 * top of them. */
function centreOutCells(count: number, w: number, h: number) {
  const usableW = Math.max(1, w - 48);
  const headerH = 42;
  const bottomPad = 16;
  const usableH = Math.max(1, h - headerH - bottomPad);
  const cols = Math.max(1, Math.ceil(Math.sqrt(count * usableW / usableH)));
  const rows = Math.max(1, Math.ceil(count / cols));
  const cellW = usableW / cols;
  const cellH = usableH / rows;
  const cells: { x: number; y: number; order: number }[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (cells.length >= count) break;
      const x = -usableW / 2 + (col + 0.5) * cellW;
      const y = -h / 2 + headerH + (row + 0.5) * cellH;
      const nx = (col + 0.5) / cols - 0.5;
      const ny = (row + 0.5) / rows - 0.5;
      cells.push({ x, y, order: nx * nx + ny * ny });
    }
  }
  cells.sort((a, b) => a.order - b.order || a.y - b.y || a.x - b.x);
  return { cells, cellW, cellH };
}

export function buildClusteredLayout(
  raw: KerfNode[], edges: KerfEdge[], narrow = false,
): {
  nodes: LayoutNode[];
  clusters: ClusterBox[];
} {
  const degrees = new Array<number>(raw.length).fill(0);
  for (const edge of edges) {
    if (edge.s >= 0 && edge.s < raw.length) degrees[edge.s]++;
    if (edge.t >= 0 && edge.t < raw.length) degrees[edge.t]++;
  }

  const byKind = new Map<string, number[]>();
  raw.forEach((node, id) => {
    const members = byKind.get(node.kind);
    if (members) members.push(id); else byKind.set(node.kind, [id]);
  });
  const clusters = buildBoxes(new Map(
    Array.from(byKind, ([kind, members]) => [kind, members.length]),
  ), narrow);
  const boxByKind = new Map(clusters.map((box) => [box.kind, box]));
  const result = new Array<LayoutNode>(raw.length);

  for (const [kind, members] of byKind) {
    const box = boxByKind.get(kind);
    if (!box) continue;
    members.sort((a, b) => degrees[b] - degrees[a]
      || raw[a].label.localeCompare(raw[b].label));
    const { cells, cellW, cellH } = centreOutCells(members.length, box.w, box.h);
    members.forEach((id, index) => {
      const cell = cells[index];
      const naturalR = 3.1 + Math.sqrt(degrees[id]) * 1.15 + raw[id].trust * 0.22;
      result[id] = {
        ...raw[id], id,
        x: box.x + cell.x,
        y: box.y + cell.y,
        deg: degrees[id],
        r: Math.min(naturalR, Math.max(2.8, Math.min(cellW, cellH) * 0.27)),
      };
    });
  }

  return { nodes: result, clusters };
}

type PortSide = 'left' | 'right' | 'top' | 'bottom';
interface PortCandidate {
  side: PortSide;
  port: RoutePoint;
  lead: RoutePoint;
  outwardX: number;
  outwardY: number;
}
interface RouteRect {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

const routeClamp = (value: number, low: number, high: number) =>
  value < low ? low : value > high ? high : value;

const pointKey = (point: RoutePoint) => `${point.x}:${point.y}`;

function connectionPorts(
  box: ClusterBox, towards: ClusterBox, clearance: number,
): PortCandidate[] {
  // Aim the port towards the other cluster, but keep it away from rounded
  // panel corners and headings. The router may still choose another side if
  // the direct corridor is blocked.
  const portX = routeClamp(towards.x, box.x - box.w * .28, box.x + box.w * .28);
  const portY = routeClamp(towards.y, box.y - box.h * .25, box.y + box.h * .25);
  const left = box.x - box.w / 2;
  const right = box.x + box.w / 2;
  const top = box.y - box.h / 2;
  const bottom = box.y + box.h / 2;
  return [
    {
      side: 'left', port: { x: left, y: portY },
      lead: { x: left - clearance, y: portY }, outwardX: -1, outwardY: 0,
    },
    {
      side: 'right', port: { x: right, y: portY },
      lead: { x: right + clearance, y: portY }, outwardX: 1, outwardY: 0,
    },
    {
      side: 'top', port: { x: portX, y: top },
      lead: { x: portX, y: top - clearance }, outwardX: 0, outwardY: -1,
    },
    {
      side: 'bottom', port: { x: portX, y: bottom },
      lead: { x: portX, y: bottom + clearance }, outwardX: 0, outwardY: 1,
    },
  ];
}

function routeRect(box: ClusterBox, clearance: number): RouteRect {
  return {
    left: box.x - box.w / 2 - clearance,
    right: box.x + box.w / 2 + clearance,
    top: box.y - box.h / 2 - clearance,
    bottom: box.y + box.h / 2 + clearance,
  };
}

const pointInsideRect = (point: RoutePoint, rect: RouteRect) => {
  const epsilon = 1e-7;
  return point.x > rect.left + epsilon && point.x < rect.right - epsilon
    && point.y > rect.top + epsilon && point.y < rect.bottom - epsilon;
};

/** Boundary contact is allowed because the boundary is already `clearance`
 * away from the visible panel. Crossing the rectangle interior is not. */
function segmentClear(a: RoutePoint, b: RoutePoint, rects: RouteRect[]) {
  const epsilon = 1e-7;
  if (Math.abs(a.y - b.y) < epsilon) {
    const low = Math.min(a.x, b.x);
    const high = Math.max(a.x, b.x);
    return !rects.some((rect) => a.y > rect.top + epsilon
      && a.y < rect.bottom - epsilon
      && Math.max(low, rect.left) < Math.min(high, rect.right) - epsilon);
  }
  if (Math.abs(a.x - b.x) < epsilon) {
    const low = Math.min(a.y, b.y);
    const high = Math.max(a.y, b.y);
    return !rects.some((rect) => a.x > rect.left + epsilon
      && a.x < rect.right - epsilon
      && Math.max(low, rect.top) < Math.min(high, rect.bottom) - epsilon);
  }
  return false;
}

interface VisibilityEdge { to: number; direction: 1 | 2; length: number; }
interface VisibilityGraph {
  points: RoutePoint[];
  index: Map<string, number>;
  edges: VisibilityEdge[][];
}

interface OccupiedSegment { a: RoutePoint; b: RoutePoint; }

function uniqueSorted(values: number[]) {
  return Array.from(new Set(values)).sort((a, b) => a - b);
}

function buildVisibilityGraph(
  rects: RouteRect[], endpoints: RoutePoint[], clearance: number,
): VisibilityGraph {
  const outerLeft = Math.min(...rects.map((rect) => rect.left)) - clearance;
  const outerRight = Math.max(...rects.map((rect) => rect.right)) + clearance;
  const outerTop = Math.min(...rects.map((rect) => rect.top)) - clearance;
  const outerBottom = Math.max(...rects.map((rect) => rect.bottom)) + clearance;
  const xs = uniqueSorted([
    outerLeft, outerRight,
    ...rects.flatMap((rect) => [rect.left, rect.right]),
    ...endpoints.map((point) => point.x),
  ]);
  const ys = uniqueSorted([
    outerTop, outerBottom,
    ...rects.flatMap((rect) => [rect.top, rect.bottom]),
    ...endpoints.map((point) => point.y),
  ]);
  const points: RoutePoint[] = [];
  const index = new Map<string, number>();
  for (const y of ys) {
    for (const x of xs) {
      const point = { x, y };
      if (rects.some((rect) => pointInsideRect(point, rect))) continue;
      index.set(pointKey(point), points.length);
      points.push(point);
    }
  }
  const edges: VisibilityEdge[][] = Array.from({ length: points.length }, () => []);
  const connect = (a: number, b: number, direction: 1 | 2) => {
    if (!segmentClear(points[a], points[b], rects)) return;
    const length = direction === 1
      ? Math.abs(points[b].x - points[a].x)
      : Math.abs(points[b].y - points[a].y);
    if (length <= 0) return;
    edges[a].push({ to: b, direction, length });
    edges[b].push({ to: a, direction, length });
  };
  for (const y of ys) {
    const row = points
      .map((point, id) => ({ point, id }))
      .filter(({ point }) => point.y === y)
      .sort((a, b) => a.point.x - b.point.x);
    for (let index = 1; index < row.length; index++) {
      connect(row[index - 1].id, row[index].id, 1);
    }
  }
  for (const x of xs) {
    const column = points
      .map((point, id) => ({ point, id }))
      .filter(({ point }) => point.x === x)
      .sort((a, b) => a.point.y - b.point.y);
    for (let index = 1; index < column.length; index++) {
      connect(column[index - 1].id, column[index].id, 2);
    }
  }
  return { points, index, edges };
}

function routeSegments(routes: readonly (readonly RoutePoint[])[]) {
  return routes.flatMap((route) => route.slice(1).map((point, index) => ({
    a: route[index], b: point,
  })));
}

/** Penalise only visually destructive intersections. A single endpoint touch
 * is permitted (several relations may legitimately leave one panel), while a
 * proper X crossing or a shared collinear run gets a prohibitive cost. */
function segmentConflictCost(
  a: RoutePoint, b: RoutePoint, occupied: readonly OccupiedSegment[],
) {
  const epsilon = 1e-7;
  const aHorizontal = Math.abs(a.y - b.y) < epsilon;
  let cost = 0;
  for (const segment of occupied) {
    const c = segment.a;
    const d = segment.b;
    const cHorizontal = Math.abs(c.y - d.y) < epsilon;
    if (aHorizontal !== cHorizontal) {
      const horizontalA = aHorizontal ? a : c;
      const horizontalB = aHorizontal ? b : d;
      const verticalA = aHorizontal ? c : a;
      const verticalB = aHorizontal ? d : b;
      const x = verticalA.x;
      const y = horizontalA.y;
      const insideHorizontal = x > Math.min(horizontalA.x, horizontalB.x) + epsilon
        && x < Math.max(horizontalA.x, horizontalB.x) - epsilon;
      const insideVertical = y > Math.min(verticalA.y, verticalB.y) + epsilon
        && y < Math.max(verticalA.y, verticalB.y) - epsilon;
      if (insideHorizontal && insideVertical) cost += 100_000;
      continue;
    }
    if (aHorizontal) {
      if (Math.abs(a.y - c.y) >= epsilon) continue;
      const overlap = Math.min(Math.max(a.x, b.x), Math.max(c.x, d.x))
        - Math.max(Math.min(a.x, b.x), Math.min(c.x, d.x));
      if (overlap > epsilon) cost += 100_000 + overlap * 24;
    } else {
      if (Math.abs(a.x - c.x) >= epsilon) continue;
      const overlap = Math.min(Math.max(a.y, b.y), Math.max(c.y, d.y))
        - Math.max(Math.min(a.y, b.y), Math.min(c.y, d.y));
      if (overlap > epsilon) cost += 100_000 + overlap * 24;
    }
  }
  return cost;
}

function routeConflictCost(
  points: readonly RoutePoint[], occupied: readonly OccupiedSegment[],
) {
  let cost = 0;
  for (let index = 1; index < points.length; index++) {
    cost += segmentConflictCost(points[index - 1], points[index], occupied);
  }
  return cost;
}

interface HeapEntry { node: number; direction: 0 | 1 | 2; cost: number; }

function heapPush(heap: HeapEntry[], entry: HeapEntry) {
  heap.push(entry);
  let index = heap.length - 1;
  while (index > 0) {
    const parent = Math.floor((index - 1) / 2);
    if (heap[parent].cost <= entry.cost) break;
    heap[index] = heap[parent];
    index = parent;
  }
  heap[index] = entry;
}

function heapPop(heap: HeapEntry[]): HeapEntry | undefined {
  if (!heap.length) return undefined;
  const first = heap[0];
  const last = heap.pop()!;
  if (heap.length) {
    let index = 0;
    while (true) {
      const left = index * 2 + 1;
      const right = left + 1;
      if (left >= heap.length) break;
      const child = right < heap.length && heap[right].cost < heap[left].cost ? right : left;
      if (heap[child].cost >= last.cost) break;
      heap[index] = heap[child];
      index = child;
    }
    heap[index] = last;
  }
  return first;
}

function shortestOrthogonalPath(
  graph: VisibilityGraph, start: RoutePoint, end: RoutePoint,
  occupied: readonly OccupiedSegment[],
): { points: RoutePoint[]; cost: number } | null {
  const startNode = graph.index.get(pointKey(start));
  const endNode = graph.index.get(pointKey(end));
  if (startNode == null || endNode == null) return null;
  const stateKey = (node: number, direction: number) => node * 3 + direction;
  const distances = new Map<number, number>();
  const previous = new Map<number, number>();
  const heap: HeapEntry[] = [];
  const initialKey = stateKey(startNode, 0);
  distances.set(initialKey, 0);
  heapPush(heap, { node: startNode, direction: 0, cost: 0 });
  let finalKey: number | null = null;
  while (heap.length) {
    const current = heapPop(heap)!;
    const currentKey = stateKey(current.node, current.direction);
    if (current.cost !== distances.get(currentKey)) continue;
    if (current.node === endNode) {
      finalKey = currentKey;
      break;
    }
    for (const edge of graph.edges[current.node]) {
      // A substantial bend cost produces calm corridor routes rather than
      // technically shorter staircases between panels.
      const bend = current.direction !== 0 && current.direction !== edge.direction ? 68 : 0;
      const collision = segmentConflictCost(
        graph.points[current.node], graph.points[edge.to], occupied,
      );
      const cost = current.cost + edge.length + bend + collision;
      const nextKey = stateKey(edge.to, edge.direction);
      if (cost >= (distances.get(nextKey) ?? Infinity)) continue;
      distances.set(nextKey, cost);
      previous.set(nextKey, currentKey);
      heapPush(heap, { node: edge.to, direction: edge.direction, cost });
    }
  }
  if (finalKey == null) return null;
  const reversed: RoutePoint[] = [];
  let key: number | undefined = finalKey;
  while (key != null) {
    reversed.push(graph.points[Math.floor(key / 3)]);
    key = previous.get(key);
  }
  reversed.reverse();
  return { points: reversed, cost: distances.get(finalKey)! };
}

function simplifyRoute(points: RoutePoint[]) {
  const deduplicated = points.filter((point, index) => index === 0
    || point.x !== points[index - 1].x || point.y !== points[index - 1].y);
  const result: RoutePoint[] = [];
  for (const point of deduplicated) {
    const a = result[result.length - 2];
    const b = result[result.length - 1];
    if (a && b && ((a.x === b.x && b.x === point.x)
      || (a.y === b.y && b.y === point.y))) {
      result[result.length - 1] = point;
    } else {
      result.push(point);
    }
  }
  return result;
}

/** Deterministic rectilinear router for aggregate cluster relations.
 *
 * Every panel is expanded into a keep-out rectangle. A visibility graph over
 * those corridor boundaries finds the shortest low-bend route; only the first
 * and last short lead segments enter the source/target keep-out zones. Thus a
 * relation can never slice through an unrelated cluster, even when its target
 * is diagonally opposite across the 3x3 board.
 */
export function routeClusterConnection(
  boxes: ClusterBox[], source: ClusterBox, target: ClusterBox, clearance = 36,
  occupiedRoutes: readonly (readonly RoutePoint[])[] = [],
): ClusterConnectionRoute {
  const sourcePorts = connectionPorts(source, target, clearance);
  const targetPorts = connectionPorts(target, source, clearance);
  const rects = boxes.map((box) => routeRect(box, clearance));
  const graph = buildVisibilityGraph(
    rects,
    [...sourcePorts.map((candidate) => candidate.lead),
     ...targetPorts.map((candidate) => candidate.lead)],
    clearance,
  );
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const distance = Math.hypot(dx, dy) || 1;
  const directionX = dx / distance;
  const directionY = dy / distance;
  const occupied = routeSegments(occupiedRoutes);
  let best: { points: RoutePoint[]; cost: number } | null = null;
  for (const from of sourcePorts) {
    for (const to of targetPorts) {
      const path = shortestOrthogonalPath(graph, from.lead, to.lead, occupied);
      if (!path) continue;
      const sourceFacing = from.outwardX * directionX + from.outwardY * directionY;
      const targetFacing = to.outwardX * -directionX + to.outwardY * -directionY;
      const sidePenalty = (2 - sourceFacing - targetFacing) * 46;
      const points = simplifyRoute([from.port, ...path.points, to.port]);
      // Lead segments are outside the visibility graph, so score the complete
      // route once more before choosing its source/target ports.
      const score = path.cost + sidePenalty + routeConflictCost(points, occupied);
      if (best && score >= best.cost - 1e-7) continue;
      best = {
        cost: score,
        points,
      };
    }
  }
  if (!best) {
    // The visibility graph includes an outer perimeter and should always find
    // a route. Keep a deterministic, explicit fallback for malformed boxes.
    const from = sourcePorts[1];
    const to = targetPorts[0];
    const outerY = Math.min(...boxes.map((box) => box.y - box.h / 2)) - clearance * 2;
    best = {
      cost: Infinity,
      points: simplifyRoute([
        from.port, from.lead,
        { x: from.lead.x, y: outerY },
        { x: to.lead.x, y: outerY },
        to.lead, to.port,
      ]),
    };
  }
  return { points: best.points, sourceKind: source.kind, targetKind: target.kind };
}

function boxGap(a: ClusterBox, b: ClusterBox) {
  const x = Math.max(0, Math.abs(a.x - b.x) - (a.w + b.w) / 2);
  const y = Math.max(0, Math.abs(a.y - b.y) - (a.h + b.h) / 2);
  return x + y;
}

/** Route all aggregate relations as one deterministic set. Strong relations
 * reserve the cleanest corridors first; equal-weight local neighbours precede
 * long diagonals. Later routes treat earlier X crossings and shared runs as
 * prohibitive, while retaining the panel keep-outs from the base router. */
export function routeClusterConnections(
  boxes: ClusterBox[], specs: readonly ClusterConnectionSpec[], clearance = 36,
) {
  const byKind = new Map(boxes.map((box) => [box.kind, box]));
  const unique = new Map<string, Required<ClusterConnectionSpec>>();
  for (const spec of specs) {
    if (spec.sourceKind === spec.targetKind) continue;
    const sourceKind = spec.sourceKind < spec.targetKind
      ? spec.sourceKind : spec.targetKind;
    const targetKind = spec.sourceKind < spec.targetKind
      ? spec.targetKind : spec.sourceKind;
    if (!byKind.has(sourceKind) || !byKind.has(targetKind)) continue;
    const key = `${sourceKind}|${targetKind}`;
    const existing = unique.get(key);
    unique.set(key, {
      sourceKind,
      targetKind,
      weight: (existing?.weight ?? 0) + (spec.weight ?? 1),
    });
  }
  const ordered = Array.from(unique.entries()).sort(([keyA, a], [keyB, b]) => {
    if (a.weight !== b.weight) return b.weight - a.weight;
    const gapA = boxGap(byKind.get(a.sourceKind)!, byKind.get(a.targetKind)!);
    const gapB = boxGap(byKind.get(b.sourceKind)!, byKind.get(b.targetKind)!);
    return gapA - gapB || keyA.localeCompare(keyB);
  });
  const routes = new Map<string, ClusterConnectionRoute>();
  const occupied: RoutePoint[][] = [];
  for (const [key, spec] of ordered) {
    const route = routeClusterConnection(
      boxes,
      byKind.get(spec.sourceKind)!,
      byKind.get(spec.targetKind)!,
      clearance,
      occupied,
    );
    routes.set(key, route);
    occupied.push(route.points);
  }
  return routes;
}

/** Camera target used while chronology playback is active. It deliberately
 * chooses a readable 4.5-year window rather than retaining an arbitrary
 * full-history zoom, and places the current tick at the viewport centre. */
export function chronologyFollowCamera(
  chronology: ChronologyLayout,
  tick: number,
  viewportWidth: number,
  viewportHeight: number,
  visibleMinY = chronology.minY,
  visibleMaxY = chronology.maxY,
  windowMonths = 54,
): ChronologyCamera {
  const horizontalPadding = viewportWidth < 640 ? 26 : 46;
  const usableWidth = Math.max(120, viewportWidth - horizontalPadding * 2);
  const zoom = routeClamp(
    usableWidth / Math.max(1, chronology.monthWidth * windowMonths),
    0.0025,
    5,
  );
  const clampedTick = routeClamp(tick, chronology.minTick, chronology.maxTick);
  const worldX = (clampedTick - chronology.minTick) * chronology.monthWidth;
  // Reserve the bottom strip for the minimap and keep the role lanes centred
  // in the remaining canvas. Vertical clipping remains manually pannable once
  // playback is paused.
  const usableTop = 24;
  const usableBottom = Math.max(usableTop + 1, viewportHeight - 62);
  const centreY = (visibleMinY + visibleMaxY) / 2;
  return {
    zoom,
    tx: viewportWidth / 2 - worldX * zoom,
    ty: (usableTop + usableBottom) / 2 - centreY * zoom,
  };
}

/** Real-time X axis plus role lanes on Y.  Nodes sharing a month are packed
 * into four narrow columns inside that month and as many rows as required;
 * this keeps the date exact while preventing the large current-month DIP
 * batches from landing on one pixel. */
export function buildChronologyLayout(raw: KerfNode[], beliefs: KerfBelief[]): ChronologyLayout {
  // Beliefs are the actual revision/event stream. A node without one still
  // receives a corpus-appearance marker at `born`; mapped initiators also get
  // a separate historical inception marker. Keeping both matters because the
  // current payload has no belief rows for initiators.
  const nodeHasBelief = new Set(beliefs.map((belief) => belief.n));
  const inceptionEvents = raw.flatMap((node, id) => {
    if (node.kind !== 'initiator') return [];
    const tick = initiatorHistoricalSince(node.label);
    return tick == null ? [] : [{ node: id, tick, inception: true }];
  });
  const sourceEvents = [
    ...beliefs
      .filter((belief) => belief.n >= 0 && belief.n < raw.length)
      .map((belief) => ({
        node: belief.n, tick: belief.b,
        pT: belief.pT, pF: belief.pF, pN: belief.pN,
      })),
    ...inceptionEvents,
    ...raw.flatMap((node, id) => nodeHasBelief.has(id)
      ? [] : [{ node: id, tick: node.born }]),
  ];
  const minTick = Math.min(...sourceEvents.map((event) => event.tick));
  const maxTick = Math.max(...sourceEvents.map((event) => event.tick));
  // Wide enough that the default four-year window uses the canvas width;
  // the full historical span remains reachable through fit/minimap.
  const monthWidth = 44;
  const columnsPerMonth = 4;
  const rowHeight = 15;
  const laneKinds = [
    ...KIND_ORDER.filter((kind) => raw.some((node) => node.kind === kind)),
    ...Array.from(new Set(raw.map((node) => node.kind)))
      .filter((kind) => !KIND_ORDER.includes(kind as typeof KIND_ORDER[number]))
      .sort(),
  ];
  const groups = new Map<string, number[]>();
  sourceEvents.forEach((event, id) => {
    const key = `${raw[event.node].kind}|${event.tick}`;
    const group = groups.get(key);
    if (group) group.push(id); else groups.set(key, [id]);
  });
  for (const members of groups.values()) {
    members.sort((a, b) => raw[sourceEvents[a].node].label
      .localeCompare(raw[sourceEvents[b].node].label));
  }

  const maxRowsByKind = new Map<string, number>();
  for (const [key, members] of groups) {
    const kind = key.slice(0, key.lastIndexOf('|'));
    maxRowsByKind.set(kind, Math.max(
      maxRowsByKind.get(kind) ?? 0,
      Math.ceil(members.length / columnsPerMonth),
    ));
  }

  const lanes: ChronologyLane[] = [];
  let top = 0;
  for (const kind of laneKinds) {
    const rows = maxRowsByKind.get(kind) ?? 1;
    const h = Math.max(86, rows * rowHeight + 46);
    lanes.push({ kind, y: top + h / 2, h });
    top += h + 22;
  }
  const laneByKind = new Map(lanes.map((lane) => [lane.kind, lane]));

  const events = new Array<ChronologyEvent>(sourceEvents.length);
  for (const members of groups.values()) {
    members.forEach((id, index) => {
      const source = sourceEvents[id];
      const node = raw[source.node];
      const lane = laneByKind.get(node.kind)!;
      const totalRows = Math.ceil(members.length / columnsPerMonth);
      const column = index % columnsPerMonth;
      const row = Math.floor(index / columnsPerMonth);
      events[id] = {
        ...source,
        x: (source.tick - minTick) * monthWidth
          + (column - (columnsPerMonth - 1) / 2) * 7.2,
        y: lane.y + (row - (totalRows - 1) / 2) * rowHeight + 7,
      };
    });
  }
  events.sort((a, b) => a.tick - b.tick || a.node - b.node);
  const eventsByNode = Array.from({ length: raw.length }, () => [] as ChronologyEvent[]);
  for (const event of events) eventsByNode[event.node].push(event);

  return {
    events,
    eventsByNode,
    lanes,
    minTick,
    maxTick,
    monthWidth,
    minX: -70,
    maxX: (maxTick - minTick) * monthWidth + 70,
    minY: -48,
    maxY: top - 22 + 48,
  };
}
