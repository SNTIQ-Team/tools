// Tree-integrity audit: npx tsx modules/taper/audit.ts [graph.json]
// (fetch: curl -s https://api.sntiq.com/taper/graph -o /tmp/graph.json)
import { readFileSync } from 'fs';
import { buildOmnigram } from './omnitree';
const graphPath = process.argv[2] ?? '/tmp/g7.json';
const g = JSON.parse(readFileSync(graphPath, 'utf8'));
const b = buildOmnigram(g.nodes, g.edges, g.kreise ?? {});
const name = (id: number) => b.byId.get(id)?.name ?? `?${id}`;
const kids = (id: number) => b.childrenOf.get(id) ?? [];

console.log('=== root:', kids(0).length, kids(0).map(name).join(' | '));
console.log('=== Bund kids:', kids(-900).length, kids(-900).map(name).slice(0, 12));
console.log('=== Bayern kids:', kids(-9).length, kids(-9).map(name));
const ob = kids(-9).map(Number).find((k) => name(k).includes('Oberbayern'));
console.log('=== Oberbayern kids:', ob ? kids(ob).length : 'NOT FOUND',
  ob ? kids(ob).map(name).slice(0, 10) : '');
// Erding kreis hub id
const erding = -(100000 + 9177);
console.log('=== Erding hub exists:', b.byId.has(erding),
  b.byId.has(erding) ? `${kids(erding).length} kids:` : '',
  b.byId.has(erding) ? kids(erding).map(name).slice(0, 15) : '');
console.log('=== NRW kids:', kids(-5).length, kids(-5).map(name).slice(0, 10));
// anomalies
let dupParents = 0, selfLoop = 0;
const seen = new Map<number, number>();
for (const [p, cs] of b.childrenOf) {
  for (const c of cs) {
    if (c === p) selfLoop++;
    seen.set(c, (seen.get(c) ?? 0) + 1);
  }
}
for (const [, cnt] of seen) if (cnt > 1) dupParents++;
console.log('=== anomalies: selfLoops', selfLoop, '| nodes with >1 parent', dupParents);
// orphans: nodes not reachable from 0
const reach = new Set([0]);
const st = [0];
while (st.length) {
  const v = st.pop()!;
  for (const c of kids(v)) if (!reach.has(c)) { reach.add(c); st.push(c); }
}
console.log('=== reachable:', reach.size, '/', b.nodes.length);
if (selfLoop || dupParents || reach.size !== b.nodes.length) process.exitCode = 1;
