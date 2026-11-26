// Focused regression: a malformed [id,id,*] edge must not detach that node
// and all of its descendants from the visual root.
import {
  BUND_DOMAIN, buildOmnigram, EU_DOMAIN, GERMANY_DOMAIN, WORKSPACE_ROOT,
  type RawGraphEdge,
} from './omnitree';

const nodes: [number, string, string, string | null,
              string | null | undefined][] = [
  [1, 'jobcenter', 'Parent', '09', '09162'],
  [2, 'sonstige', 'Child', '09', '09162'],
  [3, 'sonstige', 'Grandchild', '09', '09162'],
  [4, 'eu_institution', 'European Test Institution', null, null],
  [5, 'ministerium', 'Bundesministerium Test', null, null],
];
const edges: RawGraphEdge[] = [
  [1, 1, 'parent'],
  [2, 1, 'parent'],
  [3, 2, 'parent'],
];

const built = buildOmnigram(nodes, edges, { '09162': 'München' });
if (built.upOf.get(1) === 1 || built.childrenOf.get(1)?.includes(1)) {
  throw new Error('self-loop survived tree construction');
}

const reachable = new Set<number>([0]);
const pending = [0];
while (pending.length) {
  const parent = pending.pop()!;
  for (const child of built.childrenOf.get(parent) ?? []) {
    if (!reachable.has(child)) {
      reachable.add(child);
      pending.push(child);
    }
  }
}
for (const id of [1, 2, 3, 4, 5]) {
  if (!reachable.has(id)) throw new Error(`authority ${id} is unreachable`);
}

const domains = built.childrenOf.get(WORKSPACE_ROOT) ?? [];
if (!domains.includes(EU_DOMAIN) || !domains.includes(GERMANY_DOMAIN)) {
  throw new Error('workspace does not expose independent EU and DE domains');
}
if (domains.includes(BUND_DOMAIN)) {
  throw new Error('Bund must not be a peer of the EU domain');
}
const germany = built.childrenOf.get(GERMANY_DOMAIN) ?? [];
if (!germany.includes(BUND_DOMAIN) || !germany.includes(-9)) {
  throw new Error('Bund and Land must be grouped inside Germany');
}

console.log('self-loop regression OK');
