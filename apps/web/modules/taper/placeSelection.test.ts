import assert from 'node:assert/strict';
import test from 'node:test';
import { agCourtChain, agSearchPlaces } from './client';

test('name and ambiguous postcode responses cannot seed a court lookup with MIN(postcode)', async () => {
  const original = globalThis.fetch;
  try {
    for (const [query, plz, explicit, expected] of [
      ['Ingolstadt', '85047', undefined, null],
      ['Ingolstadt', null, false, null],
      ['85049', '85049', true, '85049'],
      ['85049', '85049', undefined, '85049'],
      ['85049', '85049', false, null],
      ['1011', '10115', true, '10115'],
      ['1011', '10178', true, null],
    ] as const) {
      globalThis.fetch = async () => Response.json({ query, matches: [{ ags: '09161000', name: 'Ingolstadt', plz, explicit_postcode: explicit }] });
      const result = await agSearchPlaces(query);
      assert.equal(result.matches[0].plz, expected, query + ' explicit=' + explicit);
      assert.equal(result.matches[0].name, 'Ingolstadt');
    }
  } finally { globalThis.fetch = original; }
});

test('an unmatched city offers the court register locality before retrieving its chain', async t => {
  const paths: URL[] = [];
  const place = { ort: 'Neustadt', ortk: 'NEUSTADT', place_id: 'place:jz:67434:NEUSTADT' };
  const chain = [{ id: 1, name: 'Court', role: 'court', position: 1 }];
  t.mock.method(globalThis, 'fetch', async (input: string) => {
    const url = new URL(String(input), 'https://example.invalid');
    paths.push(url);
    if (url.searchParams.get('ort')) {
      return Response.json({ status: 'not_found_in_searched_scope', chain: [] }, { status: 404 });
    }
    return Response.json({ status: 'ok', place, chain });
  });
  const discovery = await agCourtChain('67434', 'verwaltung', 'Neustadt an der Weinstraße');
  assert.deepEqual(discovery.options, [place]);
  assert.equal(discovery.chain, undefined);
  const confirmed = await agCourtChain('67434', 'verwaltung', undefined, undefined, 'NEUSTADT');
  assert.deepEqual(confirmed.chain, chain);
  assert.equal(paths[2].searchParams.get('ortk'), 'NEUSTADT');
});

test('a known court-register gap retains the source caveat and plain transport failures remain errors', async t => {
  const gap = { status: 'not_found_in_searched_scope', place: { ort: 'Berlin', ortk: 'BERLIN' },
    chain: [], caveats: [{ severity: 'warn', text_de: 'Justizportal', source: 'justizadressen' }] };
  const fetch = t.mock.method(globalThis, 'fetch', async () => Response.json(gap, { status: 404 }));
  assert.deepEqual(await agCourtChain('10178', 'zivil', 'Berlin'), gap);
  assert.equal(fetch.mock.callCount(), 1);
  fetch.mock.mockImplementation(async () => new Response('upstream error', { status: 404 }));
  await assert.rejects(() => agCourtChain('10178', 'zivil', 'Berlin'));
});
