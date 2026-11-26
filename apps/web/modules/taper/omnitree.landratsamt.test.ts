import { buildOmnigram, type RawGraphEdge } from './omnitree';
import { normaliseAgDetail, type AgDetail } from './client';

const nodes: [number, string, string, string | null,
              string | null | undefined][] = [
  [1, 'sonstige', 'Landratsamt Pfaffenhofen a.d.Ilm', '09', '09186'],
  [2, 'sonstige', 'Landratsamt Pfaffenhofen a.d.Ilm - Büro Landrat',
    '09', '09186'],
  [3, 'sonstige', 'Landratsamt Wunsiedel i.Fichtelgebirge - IDF GmbH',
    '09', '09479'],
  [4, 'sonstige', 'Landratsamt IT', '09', '09479'],
  [5, 'auslaenderbehoerde', 'Landratsamt Zwickau', '14', '14524'],
  [6, 'sonstige', 'Sonstige Kreisstelle', '09', '09186'],
];
const edges: RawGraphEdge[] = [
  [2, 1, 'parent'],
  [4, 3, 'parent'],
];

const built = buildOmnigram(nodes, edges);
const kind = (id: number) => built.byId.get(id)?.kind;

if (kind(1) !== 'landratsamt') {
  throw new Error('unparented Landratsamt root remained sonstige');
}
if (kind(2) !== 'sonstige' || kind(4) !== 'sonstige') {
  throw new Error('Landratsamt department was promoted to office root');
}
if (kind(5) !== 'auslaenderbehoerde') {
  throw new Error('evidenced functional kind was overwritten');
}
if (kind(6) !== 'sonstige') {
  throw new Error('unrelated sonstige authority was reclassified');
}

const detail = (id: number, name: string, related: AgDetail['related']) => ({
  id,
  kind: 'sonstige',
  name,
  street: null,
  plz: null,
  city: null,
  postal_address: null,
  phone: null,
  fax: null,
  email: null,
  web: null,
  external_ids: {},
  provenance: { source: 'test', url: null, fetched_at: '2026-07-15' },
  related,
  related_incoming: [],
} satisfies AgDetail);

const pfaffenhofen = normaliseAgDetail(
  detail(14792, 'Landratsamt Pfaffenhofen a.d.Ilm', []),
);
if (pfaffenhofen.kind !== 'landratsamt') {
  throw new Error('Pfaffenhofen card detail remained sonstige');
}
const itDepartment = normaliseAgDetail(detail(12862, 'Landratsamt IT', [{
  id: 12861,
  name: 'Landratsamt Wunsiedel i.Fichtelgebirge - IDF GmbH',
  kind: 'sonstige',
  relation: 'parent',
  matter: null,
}]));
if (itDepartment.kind !== 'sonstige') {
  throw new Error('parented Landratsamt IT card became an office root');
}

console.log('Landratsamt kind normalisation regression OK');
