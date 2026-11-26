import assert from 'node:assert/strict';
import test from 'node:test';
import { graphConnections, graphMatches, graphActId, graphNodeLabel } from './graphExplorer';
import type { KerfAct } from './client';
import type { KerfNode, KerfEdge } from './kerfArenaLayout';

const nodes: KerfNode[] = [
  { label: 'SGB 12 — Sozialgesetzbuch', kind: 'fed-act', born: 10, trust: 5 },
  { label: 'Änderung Sozialgesetzbuch', kind: 'vorgang', born: 11, trust: 3 },
  { label: 'Bayern', kind: 'initiator', born: 20, trust: 4 },
];
const edges: KerfEdge[] = [{ s: 1, t: 0, r: 20, d: .6 }, { s: 1, t: 0, r: 21, d: 1 }, { s: 2, t: 0, r: 10, d: 1 }];

test('graph search respects time and hidden categories and matches accents', () => {
  assert.deepEqual(graphMatches(nodes, 'anderung sozial', new Set(), 15), [1]);
  assert.deepEqual(graphMatches(nodes, '', new Set(['vorgang']), 15), [0]);
});
test('connection list retains direction and distinguishes candidate from extracted amendments', () => {
  assert.deepEqual(graphConnections(nodes, edges, 0, new Set(), 15).map(row => [row.nodeId, row.relation, row.outgoing]), [[1,20,false],[1,21,false]]);
  assert.equal(graphConnections(nodes, edges, 0, new Set(['vorgang']), 15).length, 0);
});
test('law navigation requires a unique exact abbreviation and matching jurisdiction', () => {
  const acts = [{ id: 'fed_sgb_12', jurabk: 'SGB 12', juris: 'DE' }, { id: 'by_other', jurabk: 'SGB 12', juris: 'DE-BY' }] as KerfAct[];
  assert.equal(graphActId(nodes[0], acts), 'fed_sgb_12');
  assert.equal(graphActId(nodes[1], acts), null);
  assert.equal(graphActId(nodes[0], [...acts, { ...acts[0], id: 'duplicate' }]), null);
});

test('graph labels use complete law titles and search accepts familiar Roman book names', () => {
  const acts = [{ id: 'fed_sgb_12', jurabk: 'SGB 12', juris: 'DE', title: 'Sozialgesetzbuch XII - Sozialhilfe' }] as KerfAct[];
  const labels = nodes.map(node => graphNodeLabel(node, acts));
  assert.equal(labels[0], 'SGB XII — Sozialgesetzbuch XII - Sozialhilfe');
  assert.deepEqual(graphMatches(nodes, 'SGB XII', new Set(), 15, labels), [0]);
  assert.deepEqual(graphMatches(nodes, 'SGB 12', new Set(), 15, labels), [0]);
});
