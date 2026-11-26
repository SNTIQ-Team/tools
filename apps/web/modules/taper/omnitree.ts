/**
 * Tree construction for the authority omnigram — shared by renderers.
 * Builds two independent visual domains below an invisible workspace:
 * European Union and Germany. Inside Germany, Bund and the 16 Länder are
 * sibling jurisdictions; below a Land the administrative ladder continues
 * through Regierungsbezirk and Kreis. Virtual edges arrange the view only.
 * See GermanyGraph.tsx for the interaction layer.
 */

import { normaliseAuthorityKind } from './authorityKind';

export const LAND_NAMES: Record<string, string> = {
  '01': 'Schleswig-Holstein', '02': 'Hamburg', '03': 'Niedersachsen',
  '04': 'Bremen', '05': 'Nordrhein-Westfalen', '06': 'Hessen',
  '07': 'Rheinland-Pfalz', '08': 'Baden-Württemberg', '09': 'Bayern',
  '10': 'Saarland', '11': 'Berlin', '12': 'Brandenburg',
  '13': 'Mecklenburg-Vorpommern', '14': 'Sachsen', '15': 'Sachsen-Anhalt',
  '16': 'Thüringen',
};

const RB_NAMES: Record<string, string> = {
  '091': 'Oberbayern', '092': 'Niederbayern',
  // Unlike the other Bavarian district governments, the official name uses
  // the genitive article: "Regierung der Oberpfalz". There is currently no
  // real government root in the compact graph to replace this virtual hub,
  // so keep the official fallback here instead of showing only the region.
  '093': 'Regierung der Oberpfalz',
  '094': 'Oberfranken', '095': 'Mittelfranken', '096': 'Unterfranken',
  '097': 'Schwaben', '081': 'Stuttgart', '082': 'Karlsruhe',
  '083': 'Freiburg', '084': 'Tübingen', '064': 'Darmstadt',
  '065': 'Gießen', '066': 'Kassel', '051': 'Düsseldorf', '053': 'Köln',
  '055': 'Münster', '057': 'Detmold', '059': 'Arnsberg',
};
const isJudicial = (k: string) =>
  k.includes('gericht') || k.includes('staatsanwalt') || k === 'eu_court';
const isEuropean = (k: string) => k.startsWith('eu_');

/** Stable ids for non-semantic view containers. */
export const WORKSPACE_ROOT = 0;
export const BUND_DOMAIN = -900;
export const EU_DOMAIN = -901;
export const GERMANY_DOMAIN = -902;

export const KIND_COLORS: Record<string, string> = {
  auslaenderbehoerde: '#3b82f6', sozialamt: '#10b981',
  asylblg_behoerde: '#14b8a6', jobcenter: '#f59e0b',
  jugendamt: '#a855f7', wohngeldstelle: '#06b6d4',
  standesamt: '#64748b', ministerium: '#e879f9',
  aufsichtsbehoerde: '#e879f9', buergeramt: '#22d3ee',
  landratsamt: '#60a5fa',
  eu_institution: '#38bdf8', eu_body: '#2dd4bf',
  eu_court: '#fb7185', eu_hub: '#60a5fa',
  de_hub: '#a78bfa', workspace: '#64748b',
  sonstige: '#7c8aa0',
};
export const colorFor = (k: string) =>
  KIND_COLORS[k] ?? (isJudicial(k)
    ? '#ef4444' : '#8b5cf6');

export const REL_COLORS: Record<string, string> = {
  parent: 'rgba(96,165,250,0.30)',
  supervision: 'rgba(232,121,249,0.34)',
  appeal: 'rgba(248,113,113,0.30)',
  successor: 'rgba(148,163,184,0.25)',
  institutional_part: 'rgba(56,189,248,0.46)',
  political_accountability: 'rgba(251,191,36,0.52)',
  judicial_review: 'rgba(251,113,133,0.52)',
  co_legislation: 'rgba(45,212,191,0.48)',
  reporting_accountability: 'rgba(250,204,21,0.50)',
  financial_audit: 'rgba(167,139,250,0.52)',
  maladministration_review: 'rgba(34,211,238,0.50)',
  sectoral_oversight: 'rgba(192,132,252,0.52)',
  virtual: 'rgba(100,116,139,0.20)',
};

/** Canvas dash patterns in screen pixels. Empty means a solid relation. */
export const REL_DASHES: Record<string, number[]> = {
  parent: [], institutional_part: [],
  supervision: [5, 4], sectoral_oversight: [5, 4],
  appeal: [8, 4], judicial_review: [7, 3, 2, 3],
  political_accountability: [10, 4, 2, 4],
  reporting_accountability: [10, 4, 2, 4],
  financial_audit: [6, 3], maladministration_review: [7, 3, 2, 3],
  co_legislation: [2, 5], successor: [3, 4], virtual: [],
};

/** Co-legislation is a joint process, deliberately not drawn as hierarchy. */
export const relationIsDirected = (rel: string) => rel !== 'co_legislation';

export interface ONode {
  id: number; kind: string; name: string;
  x: number; y: number; depth: number;
  searchText: string;
  virtual?: boolean;
}
export interface OLink { a: number; b: number; rel: string; tree: boolean }

export type RawGraphEdge = [number, number, string, ...unknown[]];

const UP_PRIORITY: Record<string, number> = {
  parent: 0, institutional_part: 1, appeal: 2,
  supervision: 3, successor: 4,
};

export interface Built {
  nodes: ONode[];
  links: OLink[];
  byId: Map<number, ONode>;
  childrenOf: Map<number, number[]>;
  upOf: Map<number, number>;
  upRelOf: Map<number, string>;
  /** Non-tree links by source; avoids scanning the full graph per frame. */
  secondaryFrom: Map<number, OLink[]>;
  /** render batches: [style key, pairs of node refs] */
  batches: [string, [ONode, ONode][]][];
  /** spatial hash for O(1) hit-testing */
  grid: Map<string, ONode[]>;
}

export const CELL = 90;
const cellKey = (x: number, y: number) =>
  `${Math.floor(x / CELL)}:${Math.floor(y / CELL)}`;

export function buildOmnigram(
  rawNodes: [number, string, string, string | null,
             string | null | undefined][],
  rawEdges: RawGraphEdge[],
  kreisNames: Record<string, string> = {},
): Built {
  const structurallyParented = new Set<number>();
  for (const [a, b, rel] of rawEdges) {
    if (rel === 'parent' && a !== b) structurallyParented.add(a);
  }
  const byId = new Map<number, ONode>();
  const land = new Map<number, string | null>();
  const kreisOf = new Map<number, string | null>();
  const nodes: ONode[] = [];
  for (const [id, rawKind, name, lc, kc] of rawNodes) {
    const kind = normaliseAuthorityKind(
      rawKind, name, structurallyParented.has(id),
    );
    const n: ONode = {
      id, kind, name, x: 0, y: 0, depth: 0,
      searchText: `${name} ${kind.replaceAll('_', ' ')}`.toLocaleLowerCase(),
    };
    nodes.push(n); byId.set(id, n); land.set(id, lc);
    kreisOf.set(id, kc ?? null);
  }
  // choose ONE tree-parent per node (child → "to" is upper).
  // Only structural `parent` / `institutional_part` edges form the tree
  // (appeal too, but only between courts: the instance ladder). Review,
  // accountability, co-legislation, review and supervision NEVER do — otherwise
  // every Landratsamt gets pulled out of its Kreis into the
  // supervising Regierung sector; it stays as a dashed secondary arc.
  const treeRel = (a: number, b: number, rel: string): boolean => {
    if (rel === 'parent' || rel === 'institutional_part') return true;
    if (rel === 'appeal') {
      const na = byId.get(a), nb = byId.get(b);
      return Boolean(na && nb && isJudicial(na.kind) &&
                     isJudicial(nb.kind));
    }
    return false;
  };
  const up = new Map<number, [number, string]>();
  const links: OLink[] = [];
  // The compact graph omits `matter`, so one court route may arrive more
  // than once. Drawing exact duplicate triples wastes memory and frames.
  const seenEdges = new Set<string>();
  for (const [a, b, rel] of rawEdges) {
    // A self-parent makes the node its own child and disconnects its entire
    // subtree from the visual root. Builds reject these and the API filters
    // them, but keep the renderer safe for stale browser/CDN payloads too.
    if (a === b || !byId.has(a) || !byId.has(b)) continue;
    const edgeKey = `${a}|${b}|${rel}`;
    if (seenEdges.has(edgeKey)) continue;
    seenEdges.add(edgeKey);
    const cur = up.get(a);
    if (treeRel(a, b, rel) &&
        (!cur || (UP_PRIORITY[rel] ?? 9) < (UP_PRIORITY[cur[1]] ?? 9))) {
      if (cur) links.push({ a, b: cur[0], rel: cur[1], tree: false });
      up.set(a, [b, rel]);
    } else {
      links.push({ a, b, rel, tree: false });
    }
  }
  // cycle guard: walking up must terminate
  const root: ONode = {
    id: WORKSPACE_ROOT, kind: 'workspace', name: 'Ansichtsbereiche',
    x: 0, y: 0, depth: 0,
    searchText: 'ansicht workspace institutionenräume',
    virtual: true,
  };
  nodes.push(root); byId.set(WORKSPACE_ROOT, root);
  const landNode = (lc: string): ONode => {
    const vid = -Number(lc);
    let n = byId.get(vid);
    if (!n) {
      const name = LAND_NAMES[lc] ?? `Land ${lc}`;
      n = { id: vid, kind: 'land', name,
            x: 0, y: 0, depth: 1, searchText: name.toLocaleLowerCase(),
            virtual: true };
      nodes.push(n); byId.set(vid, n);
      const parent = germanyHub().id;
      links.push({ a: vid, b: parent, rel: 'virtual', tree: true });
      const arr = children.get(parent) ?? [];
      arr.push(vid); children.set(parent, arr);
    }
    return n;
  };
  const children = new Map<number, number[]>();
  const addChild = (p: number, c: number) => {
    const arr = children.get(p) ?? [];
    arr.push(c); children.set(p, arr);
  };
  // virtual hubs for the administrative ladder
  const hub = (vid: number, name: string, parent: number,
               kind = 'land'): ONode => {
    let n = byId.get(vid);
    if (!n) {
      n = { id: vid, kind, name, x: 0, y: 0, depth: 0,
            searchText: `${name} ${kind}`.toLocaleLowerCase(),
            virtual: true };
      nodes.push(n); byId.set(vid, n);
      addChild(parent, vid);
      links.push({ a: vid, b: parent, rel: 'virtual', tree: true });
    }
    return n;
  };
  // Purely visual grouping anchors. They are not authorities and their
  // virtual links assert neither supervision nor legal primacy. Crucially,
  // Bund is grouped inside Germany instead of being shown as a peer of the EU.
  const germanyHub = () =>
    hub(GERMANY_DOMAIN, 'Deutschland', WORKSPACE_ROOT, 'de_hub');
  const bundHub = () => hub(BUND_DOMAIN, 'Bund', germanyHub().id);
  const euHub = () =>
    hub(EU_DOMAIN, 'Europäische Union', WORKSPACE_ROOT, 'eu_hub');
  const justizHub = (lc: string) =>
    hub(-(Number(lc) * 1000 + 500), 'Justiz', landNode(lc).id, 'justiz');
  const rbHub = (rb: string, lc: string) =>
    hub(-(1000 + Number(rb)), RB_NAMES[rb] ?? `RB ${rb}`,
        landNode(lc).id);
  const kreisHub = (kc: string, parent: number) =>
    hub(-(100000 + Number(kc)), kreisNames[kc] ?? `Kreis ${kc}`,
        parent, 'kreis');

  /** Workspace → {EU, Deutschland}; Deutschland → {Bund, Länder} →
   *  Regierungsbezirk → Kreis → real trees. A root attaches to the deepest level we can
   *  derive for it; 'Regierung von …' roots ARE the RB attachment. */
  const FEDERAL = /^Bundes(verwaltungsgericht|gerichtshof|sozialgericht|arbeitsgericht|finanzhof|verfassungsgericht|patentgericht)/;
  const anchorFor = (id: number): number => {
    const n = byId.get(id)!;
    const lc = land.get(id);
    if (isEuropean(n.kind)) return euHub().id;
    if (n.kind === 'bundesgericht' || FEDERAL.test(n.name)) {
      return bundHub().id;
    }
    if (!lc) return bundHub().id;
    if (isJudicial(n.kind)) return justizHub(lc).id;
    const kc = kreisOf.get(id);
    const rb = kc && RB_NAMES[kc.slice(0, 3)] ? kc.slice(0, 3) : null;
    if (/^(Regierung (von|der)|Bezirksregierung|Regierungspräsidium) /.test(n.name)) {
      const m = Object.entries(RB_NAMES).find(([, nm]) =>
        n.name.includes(nm));
      if (m) return rbHub(m[0], lc).id;
    }
    if (kc) {
      const parent = rb ? rbHub(rb, lc).id : landNode(lc).id;
      return kreisHub(kc, parent).id;
    }
    return landNode(lc).id;
  };
  for (const n of nodes) {
    if (n.virtual) continue;
    const u = up.get(n.id);
    if (u && byId.has(u[0])) {
      // guard against 2-cycles: if the parent's parent is us, break
      const pu = up.get(u[0]);
      if (pu && pu[0] === n.id && u[0] > n.id) {
        const anchor = anchorFor(n.id);
        addChild(anchor, n.id);
        links.push({ a: n.id, b: anchor, rel: 'virtual', tree: true });
      } else {
        addChild(u[0], n.id);
        links.push({ a: n.id, b: u[0], rel: u[1], tree: true });
      }
    } else {
      const anchor = anchorFor(n.id);
      addChild(anchor, n.id);
      links.push({ a: n.id, b: anchor, rel: 'virtual', tree: true });
    }
  }
  // collapse single-child kreis hubs: the lone Landratsamt IS the level
  for (const n of [...nodes]) {
    if (!n.virtual || n.id > -100000) continue;
    const kids = children.get(n.id) ?? [];
    if (kids.length === 1) {
      const parentLink = links.find((l) => l.tree && l.a === n.id);
      const childLink = links.find((l) => l.tree && l.b === n.id);
      if (parentLink && childLink) {
        childLink.b = parentLink.b;
        const pk = children.get(parentLink.b) ?? [];
        pk[pk.indexOf(n.id)] = kids[0];
        children.set(parentLink.b, pk);
        children.delete(n.id);
        links.splice(links.indexOf(parentLink), 1);
        nodes.splice(nodes.indexOf(n), 1);
        byId.delete(n.id);
      }
    }
  }
  // municipality grouping: department roots without edges (PVOG)
  // land flat in the kreis hub — fold "Gemeinde X - Amt" under the
  // "Gemeinde X" anchor (real node when present, virtual otherwise)
  let vseq = -2_000_000;
  const containers = nodes.filter(
    (n) => n.virtual && (n.id <= -100000 ||
                         (n.id <= -1000 && n.id > -100000)));
  for (const cont of containers) {
    const kidsC = children.get(cont.id) ?? [];
    const groups = new Map<string, number[]>();
    for (const k of kidsC) {
      const c = byId.get(k);
      if (!c || c.virtual) continue;
      const prefix = c.name.split(' - ')[0].trim();
      if (!prefix || prefix === cont.name) continue;
      const arr = groups.get(prefix) ?? [];
      arr.push(k);
      groups.set(prefix, arr);
    }
    for (const [prefix, ids2] of groups) {
      const anchorReal = ids2.find(
        (k) => byId.get(k)!.name.trim() === prefix);
      const lone = ids2.length < 2;
      if (lone && anchorReal != null) continue; // already the anchor
      if (lone && !byId.get(ids2[0])!.name.includes(' - ')) {
        continue; // standalone municipality node — fine as is
      }
      let anchorId: number;
      if (anchorReal != null) {
        anchorId = anchorReal;
      } else {
        anchorId = vseq--;
        const hubN: ONode = {
          id: anchorId, kind: 'gemeinde', name: prefix,
          x: 0, y: 0, depth: 0, searchText: prefix.toLocaleLowerCase(),
          virtual: true,
        };
        nodes.push(hubN); byId.set(anchorId, hubN);
        addChild(cont.id, anchorId);
        links.push({ a: anchorId, b: cont.id, rel: 'virtual',
                     tree: true });
      }
      for (const k of ids2) {
        if (k === anchorId) continue;
        // re-hang: remove from the container, attach to the anchor
        const arr = children.get(cont.id) ?? [];
        const ix = arr.indexOf(k);
        if (ix >= 0) arr.splice(ix, 1);
        addChild(anchorId, k);
        const tl = links.find((l) => l.tree && l.a === k);
        if (tl) tl.b = anchorId;
      }
    }
  }

  // a Regierungsbezirk hub and the real "Regierung von X" are one
  // institution — let the hub carry the official name
  for (const n of nodes) {
    if (!n.virtual || n.id > -1000 || n.id <= -100000) continue;
    const kids = children.get(n.id) ?? [];
    for (const k of kids) {
      const c = byId.get(k);
      if (c && /^(Regierung (von|der)|Bezirksregierung|Regierungspräsidium) /
            .test(c.name)) {
        n.name = c.name.split(' - ')[0];
        break;
      }
    }
  }

  const rootKids = [...new Set(
    links.filter((l) => l.tree && l.b === WORKSPACE_ROOT &&
                       l.a !== WORKSPACE_ROOT)
      .map((l) => l.a))];

  // subtree weights (leaf counts, softened)
  const weight = new Map<number, number>();
  const calc = (id: number): number => {
    const kids = children.get(id) ?? [];
    let w = kids.length === 0 ? 1 : 0;
    for (const k of kids) if (!Number.isNaN(k)) w += calc(k);
    w = Math.max(w, 1);
    weight.set(id, w);
    return w;
  };
  for (const k of rootKids) calc(k);

  // radial layout
  const RING = 130;
  const place = (id: number, a0: number, a1: number, depth: number) => {
    const n = byId.get(id);
    if (!n) return;
    const am = (a0 + a1) / 2;
    const r = depth === 0 ? 0 : 90 + (depth - 1) * RING;
    n.x = Math.cos(am) * r;
    n.y = Math.sin(am) * r;
    n.depth = depth;
    const kids = (children.get(id) ?? []).filter((k) => !Number.isNaN(k));
    if (kids.length === 0) return;
    const soft = (w: number) => Math.pow(w, 0.62);
    const total = kids.reduce((s, k) => s + soft(weight.get(k) ?? 1), 0);
    let a = a0;
    for (const k of kids) {
      const span = ((a1 - a0) * soft(weight.get(k) ?? 1)) / total;
      place(k, a, a + span, depth + 1);
      a += span;
    }
  };
  {
    const soft = (w: number) => Math.pow(w, 0.62);
    const total = rootKids.reduce(
      (s, k) => s + soft(weight.get(k) ?? 1), 0) || 1;
    let a = -Math.PI / 2;
    for (const k of rootKids) {
      const span = (Math.PI * 2 * soft(weight.get(k) ?? 1)) / total;
      place(k, a, a + span, 1);
      a += span;
    }
  }
  // tree children map (for the local place view) + up map
  const childrenOf = new Map<number, number[]>();
  const upOf = new Map<number, number>();
  const upRelOf = new Map<number, string>();
  for (const l of links) {
    if (!l.tree) continue;
    upOf.set(l.a, l.b);
    upRelOf.set(l.a, l.rel);
    const arr = childrenOf.get(l.b) ?? [];
    arr.push(l.a);
    childrenOf.set(l.b, arr);
  }
  // style-batched edges: one beginPath per style, node refs precomputed
  const groups = new Map<string, [ONode, ONode][]>();
  for (const l of links) {
    const na = byId.get(l.a), nb = byId.get(l.b);
    if (!na || !nb) continue;
    const key = `${l.rel}|${l.tree ? 't' : 'x'}`;
    const arr = groups.get(key) ?? [];
    arr.push([na, nb]);
    groups.set(key, arr);
  }
  const batches = [...groups.entries()];
  const secondaryFrom = new Map<number, OLink[]>();
  for (const l of links) {
    if (l.tree) continue;
    const arr = secondaryFrom.get(l.a) ?? [];
    arr.push(l);
    secondaryFrom.set(l.a, arr);
  }
  // spatial hash
  const grid = new Map<string, ONode[]>();
  for (const n of nodes) {
    const k = cellKey(n.x, n.y);
    const arr = grid.get(k) ?? [];
    arr.push(n);
    grid.set(k, arr);
  }
  return {
    nodes, links, byId, childrenOf, upOf, upRelOf, secondaryFrom,
    batches, grid,
  };
}

/** local place view: focus nodes, ≤`upLevels` ancestors, ALL
 *  descendants — plus the virtual anchors so the tree stays rooted */
export function localSubset(d: Built, focusIds: number[], upLevels = 2):
    Set<number> {
  const vis = new Set<number>();
  for (const id of focusIds) {
    if (!d.byId.has(id)) continue;
    vis.add(id);
    let cur = id;
    for (let i = 0; i < upLevels; i++) {
      const up = d.upOf.get(cur);
      if (up == null) break;
      vis.add(up);
      cur = up;
    }
    const stack = [id];
    while (stack.length) {
      const v = stack.pop()!;
      for (const c of d.childrenOf.get(v) ?? []) {
        if (!vis.has(c)) { vis.add(c); stack.push(c); }
      }
    }
  }
  return vis;
}
