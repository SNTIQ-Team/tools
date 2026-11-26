import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildChronologyLayout, buildClusteredLayout, chronologyFollowCamera,
  initiatorHistoricalSince, KIND_ORDER, routeClusterConnection,
  routeClusterConnections,
  type ClusterBox, type KerfBelief, type KerfNode, type RoutePoint,
} from './kerfArenaLayout';

const nodes: KerfNode[] = KIND_ORDER.flatMap((kind, kindIndex) =>
  Array.from({ length: kindIndex + 2 }, (_, index) => ({
    label: `${kind}-${index}`,
    trust: 3,
    kind,
    born: 24_000 + kindIndex,
  })),
);

test('narrow graph uses a non-overlapping vertical rail', () => {
  const { nodes: placed, clusters } = buildClusteredLayout(nodes, [], true);
  assert.equal(placed.length, nodes.length);
  assert.ok(clusters.every((cluster) => cluster.x === 0));
  const ordered = [...clusters].sort((a, b) => a.y - b.y);
  for (let index = 1; index < ordered.length; index++) {
    const previousBottom = ordered[index - 1].y + ordered[index - 1].h / 2;
    const nextTop = ordered[index].y - ordered[index].h / 2;
    assert.ok(nextTop > previousBottom, 'mobile clusters must not overlap');
  }
  const positions = new Set(placed.map((node) => `${node.x}:${node.y}`));
  assert.equal(positions.size, placed.length);
});

test('node centres stay inside the framed panel body', () => {
  for (const narrow of [false, true]) {
    const { nodes: placed, clusters } = buildClusteredLayout(nodes, [], narrow);
    const byKind = new Map(clusters.map((cluster) => [cluster.kind, cluster]));
    for (const node of placed) {
      const box = byKind.get(node.kind);
      assert.ok(box, `missing panel for ${node.kind}`);
      assert.ok(node.x >= box!.x - box!.w / 2 + 24);
      assert.ok(node.x <= box!.x + box!.w / 2 - 24);
      assert.ok(node.y >= box!.y - box!.h / 2 + 42);
      assert.ok(node.y <= box!.y + box!.h / 2 - 16);
    }
  }
});

test('chronology preserves linear calendar distance', () => {
  const source: KerfNode[] = [
    { label: 'A', trust: 5, kind: 'fed-act', born: 24_000 },
    { label: 'B', trust: 5, kind: 'fed-act', born: 24_012 },
  ];
  const beliefs: KerfBelief[] = [
    { n: 0, b: 24_000, pT: .9, pF: 0, pN: .1 },
    { n: 1, b: 24_012, pT: .9, pF: 0, pN: .1 },
  ];
  const chronology = buildChronologyLayout(source, beliefs);
  assert.equal(chronology.events.length, 2);
  assert.equal(
    chronology.events[1].x - chronology.events[0].x,
    chronology.monthWidth * 12,
  );
  assert.equal(chronology.minTick, 24_000);
  assert.equal(chronology.maxTick, 24_012);
});

test('initiators keep historical inception and recent corpus activity', () => {
  assert.equal(initiatorHistoricalSince('Gruppe BSW'), 2024 * 12);
  assert.equal(initiatorHistoricalSince('Gruppe Die Linke'), 2007 * 12 + 5);
  const source: KerfNode[] = [
    { label: 'Fraktion der AfD', trust: 4, kind: 'initiator', born: 24_318 },
  ];
  // Production currently has no belief rows for initiator nodes, so `born`
  // must remain as a distinct corpus event beside the historical marker.
  const chronology = buildChronologyLayout(source, []);
  assert.equal(chronology.eventsByNode[0].length, 2);
  assert.equal(
    chronology.eventsByNode[0][0].tick,
    initiatorHistoricalSince('Fraktion der AfD'),
  );
  assert.equal(chronology.eventsByNode[0][0].inception, true);
  assert.equal(chronology.eventsByNode[0][1].tick, 24_318);
});

const segmentCrossesRect = (
  a: RoutePoint, b: RoutePoint, box: ClusterBox, padding = 0,
) => {
  const left = box.x - box.w / 2 - padding;
  const right = box.x + box.w / 2 + padding;
  const top = box.y - box.h / 2 - padding;
  const bottom = box.y + box.h / 2 + padding;
  if (a.y === b.y) {
    return a.y > top && a.y < bottom
      && Math.max(Math.min(a.x, b.x), left) < Math.min(Math.max(a.x, b.x), right);
  }
  if (a.x === b.x) {
    return a.x > left && a.x < right
      && Math.max(Math.min(a.y, b.y), top) < Math.min(Math.max(a.y, b.y), bottom);
  }
  throw new Error('route must remain orthogonal');
};

test('aggregate routes avoid every unrelated cluster panel', () => {
  const source: ClusterBox = { kind: 'eu', x: -260, y: -180, w: 180, h: 120 };
  const blocker: ClusterBox = { kind: 'vorgang', x: 0, y: 0, w: 300, h: 230 };
  const secondBlocker: ClusterBox = { kind: 'topic', x: 300, y: -50, w: 140, h: 150 };
  const target: ClusterBox = { kind: 'hub', x: 250, y: 210, w: 190, h: 130 };
  const boxes = [source, blocker, secondBlocker, target];
  const first = routeClusterConnection(boxes, source, target);
  const second = routeClusterConnection(boxes, source, target);
  assert.deepEqual(first, second, 'routing must be deterministic');
  assert.ok(first.points.length >= 3, 'blocked diagonal needs an orthogonal corridor');
  for (let index = 1; index < first.points.length; index++) {
    assert.equal(
      segmentCrossesRect(first.points[index - 1], first.points[index], blocker, 20),
      false,
      'route crosses the central panel keep-out',
    );
    assert.equal(
      segmentCrossesRect(first.points[index - 1], first.points[index], secondBlocker, 20),
      false,
      'route crosses the secondary panel keep-out',
    );
  }
});

const properCrossing = (
  a: RoutePoint, b: RoutePoint, c: RoutePoint, d: RoutePoint,
) => {
  const firstHorizontal = a.y === b.y;
  const secondHorizontal = c.y === d.y;
  if (firstHorizontal === secondHorizontal) return false;
  const h1 = firstHorizontal ? a : c;
  const h2 = firstHorizontal ? b : d;
  const v1 = firstHorizontal ? c : a;
  const v2 = firstHorizontal ? d : b;
  return v1.x > Math.min(h1.x, h2.x) && v1.x < Math.max(h1.x, h2.x)
    && h1.y > Math.min(v1.y, v2.y) && h1.y < Math.max(v1.y, v2.y);
};

const collinearOverlap = (
  a: RoutePoint, b: RoutePoint, c: RoutePoint, d: RoutePoint,
) => {
  if (a.y === b.y && c.y === d.y && a.y === c.y) {
    return Math.min(Math.max(a.x, b.x), Math.max(c.x, d.x))
      > Math.max(Math.min(a.x, b.x), Math.min(c.x, d.x));
  }
  if (a.x === b.x && c.x === d.x && a.x === c.x) {
    return Math.min(Math.max(a.y, b.y), Math.max(c.y, d.y))
      > Math.max(Math.min(a.y, b.y), Math.min(c.y, d.y));
  }
  return false;
};

test('3x3 aggregate set has no proper crossings or shared interior runs', () => {
  const { clusters } = buildClusteredLayout(nodes, [], false);
  // Real-like relation weights reproduce the former 579/13 collision between
  // the central→topic horizontal and by-act→by-bill vertical routes.
  const routes = Array.from(routeClusterConnections(clusters, [
    { sourceKind: 'vorgang', targetKind: 'topic', weight: 579 },
    { sourceKind: 'initiator', targetKind: 'vorgang', weight: 426 },
    { sourceKind: 'fed-act', targetKind: 'vorgang', weight: 242 },
    { sourceKind: 'hub', targetKind: 'vorgang', weight: 78 },
    { sourceKind: 'hub', targetKind: 'by-bill', weight: 60 },
    { sourceKind: 'eu', targetKind: 'hub', weight: 38 },
    { sourceKind: 'eu', targetKind: 'vorgang', weight: 21 },
    { sourceKind: 'hub', targetKind: 'land', weight: 14 },
    { sourceKind: 'by-act', targetKind: 'by-bill', weight: 13 },
  ]).entries());
  assert.equal(routes.length, 9);
  for (let first = 0; first < routes.length; first++) {
    for (let second = first + 1; second < routes.length; second++) {
      const [firstKey, firstRoute] = routes[first];
      const [secondKey, secondRoute] = routes[second];
      for (let a = 1; a < firstRoute.points.length; a++) {
        for (let b = 1; b < secondRoute.points.length; b++) {
          const args = [
            firstRoute.points[a - 1], firstRoute.points[a],
            secondRoute.points[b - 1], secondRoute.points[b],
          ] as const;
          assert.equal(
            properCrossing(...args), false,
            `${firstKey} properly crosses ${secondKey}`,
          );
          assert.equal(
            collinearOverlap(...args), false,
            `${firstKey} shares an interior run with ${secondKey}`,
          );
        }
      }
    }
  }
});

test('chronology follow camera centres each tick in a readable time window', () => {
  const source: KerfNode[] = [
    { label: 'A', trust: 5, kind: 'fed-act', born: 24_000 },
    { label: 'B', trust: 5, kind: 'fed-act', born: 24_120 },
  ];
  const chronology = buildChronologyLayout(source, []);
  for (const tick of [24_012, 24_060, 24_108]) {
    const camera = chronologyFollowCamera(chronology, tick, 1440, 760);
    const worldX = (tick - chronology.minTick) * chronology.monthWidth;
    assert.ok(Math.abs(camera.tx + worldX * camera.zoom - 720) < 1e-7);
    const visibleMonths = (1440 - 92) / camera.zoom / chronology.monthWidth;
    assert.ok(Math.abs(visibleMonths - 54) < 1e-7);
  }
});
