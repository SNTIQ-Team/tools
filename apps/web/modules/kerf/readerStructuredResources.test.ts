import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import type { KerfActDetail, KerfActMarkdown } from './client';
import { getStructuredNorm, loadStructuredNorms, loadArchivedStructuredNorms } from './readerStructuredResources';

const hash = (text: string) => createHash('sha256').update(text).digest('hex');
const act = (id = 'fed_test', rows = [{ enbez: '§ 1', text: 'Same text.' }]) => ({ id, norms: rows }) as KerfActDetail;
const payload = (law: KerfActDetail) => ({ schema_version: 1, act_id: law.id,
  source_url: 'https://www.gesetze-im-internet.de/test/', retrieved_at: '2026-09-27',
  norms: Object.fromEntries(law.norms!.map(norm => [norm.enbez, { text_sha256: hash(norm.text!),
    blocks: [{ type: 'element', tag: 'p', children: [{ type: 'text', text: norm.text }] }] }])) });

test('sidecar requests are shared across panes but bound to the immutable source snapshot', async t => {
  const law = act(); let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => { calls++; return Response.json(payload(law)); });
  const first = loadStructuredNorms(law), second = loadStructuredNorms(law);
  assert.equal(first, second);
  assert.equal((await first)['§ 1'].text_sha256, hash('Same text.'));
  await loadStructuredNorms(law);
  assert.equal(calls, 1);
  const changed = act(law.id, [{ enbez: '§ 1', text: 'Updated snapshot.' }]);
  await assert.rejects(loadStructuredNorms(changed));
  assert.equal(calls, 2);
});

test('hash verification is concurrent and bounded at 32 for a large act', async t => {
  const law = act('fed_large', Array.from({ length: 97 }, (_, index) => ({ enbez: `§ ${index + 1}`, text: `Text ${index}` })));
  t.mock.method(globalThis, 'fetch', async () => Response.json(payload(law)));
  const digest = crypto.subtle.digest.bind(crypto.subtle);
  let pending = 0, peak = 0, completed = 0;
  t.mock.method(crypto.subtle, 'digest', async (...args: Parameters<typeof digest>) => {
    pending++; peak = Math.max(peak, pending);
    await new Promise(resolve => setTimeout(resolve, 0));
    const value = await digest(...args);
    pending--; completed++;
    return value;
  });
  const result = await loadStructuredNorms(law);
  assert.equal(Object.keys(result).length, 97);
  assert.equal(completed, 97);
  assert.equal(peak, 32);
});

test('ambiguous duplicate designations never display one body on a different norm', async t => {
  const law = act('fed_duplicates', [
    { enbez: 'Anlage', text: 'First annex.' }, { enbez: 'Anlage', text: 'Second annex.' },
    { enbez: '§ 1', text: 'Same text.' }, { enbez: '§ 1', text: 'Same text.' },
  ]);
  t.mock.method(globalThis, 'fetch', async () => Response.json(payload(law)));
  const result = await loadStructuredNorms(law);
  assert.deepEqual(Object.keys(result), ['§ 1']);
});

test('schema mismatch and failed requests are evicted so a later attempt can recover', async t => {
  for (const invalid of [new Response('', { status: 503 }), Response.json({ ...payload(act()), act_id: 'wrong_act' }),
    Response.json({ ...payload(act()), schema_version: 2 }), Response.json({ ...payload(act()), norms: [] })]) {
    const law = act(); let calls = 0;
    const fetch = t.mock.method(globalThis, 'fetch', async () => ++calls === 1 ? invalid : Response.json(payload(law)));
    await assert.rejects(loadStructuredNorms(law));
    assert.ok((await loadStructuredNorms(law))['§ 1']);
    assert.equal(calls, 2);
    fetch.mock.restore();
  }
});

test('both source hash and whole block text must match; unknown nodes and unsafe attrs fail closed', async t => {
  const law = act('fed_validation', Array.from({ length: 5 }, (_, index) => ({ enbez: `§ ${index + 1}`, text: `Text ${index + 1}` })));
  const data: any = payload(law);
  data.norms['§ 1'].text_sha256 = hash('Other');
  data.norms['§ 2'].blocks[0].children[0].text = 'Other';
  data.norms['§ 3'].blocks[0].tag = 'script';
  data.norms['§ 4'].blocks[0].attrs = { onclick: 'evil()' };
  t.mock.method(globalThis, 'fetch', async () => Response.json(data));
  assert.deepEqual(Object.keys(await loadStructuredNorms(law)), ['§ 5']);
});

test('indexed sidecars distinguish duplicate labels and preambles by canonical source array position', async t => {
  const law = act('fed_indexed', [
    { enbez: '', text: 'Preamble.' }, { enbez: 'Anlage', text: 'First annex.' },
    { enbez: 'Anlage', text: 'Second annex.' }, { enbez: '§ 1', text: 'Same text.' },
  ]);
  const data: any = payload(law);
  data.norms_by_index = Object.fromEntries(law.norms!.map((norm, index) => [String(index), { enbez: norm.enbez,
    text_sha256: hash(norm.text!), blocks: [{ type: 'text', text: norm.text }] }]));
  t.mock.method(globalThis, 'fetch', async () => Response.json(data));
  const result = await loadStructuredNorms(law);
  for (const [index, norm] of law.norms!.entries()) {
    assert.equal(getStructuredNorm(result, law, norm), result[`@index:${index}`]);
    assert.equal(getStructuredNorm(result, law, norm)!.text_sha256, hash(norm.text!));
  }
  assert.equal(result.Anlage, undefined);
  assert.equal(getStructuredNorm(result, law, { enbez: 'Anlage', text: 'Unrelated.' }), undefined);
});

test('indexed sidecars reject wrong labels, wrong indexes, wrong bodies and reserved-key collisions', async t => {
  const law = act('fed_bad_indexed', [
    { enbez: 'Anlage', text: 'First annex.' }, { enbez: 'Anlage', text: 'Second annex.' },
    { enbez: '@index:0', text: 'Must not impersonate the first annex.' }, { enbez: '§ 1', text: 'Good.' },
  ]);
  const data: any = payload(law);
  const indexed = (norm: typeof law.norms[number]) => ({ enbez: norm.enbez,
    text_sha256: hash(norm.text!), blocks: [{ type: 'text', text: norm.text }] });
  data.norms_by_index = {
    0: { ...indexed(law.norms![0]), enbez: 'Wrong' },
    1: indexed(law.norms![0]),
    '01': indexed(law.norms![1]),
    9: indexed(law.norms![1]),
    3: indexed(law.norms![3]),
  };
  t.mock.method(globalThis, 'fetch', async () => Response.json(data));
  const result = await loadStructuredNorms(law);
  assert.deepEqual(Object.keys(result).sort(), ['@index:3', '§ 1']);
  assert.equal(getStructuredNorm(result, law, law.norms![0]), undefined);
  assert.equal(getStructuredNorm(result, law, law.norms![1]), undefined);
  assert.equal(getStructuredNorm(result, law, law.norms![2]), undefined);
});


test('official annotations retain their independent source text and hash without changing the canonical body', async t => {
  const law = act('fed_annotations', [{ enbez: '§ 147a', text: '(1) 500000 Euro.' }]);
  const data: any = payload(law);
  const annotations = [{ type: 'element', tag: 'div', children: [{ type: 'element', tag: 'p', children: [
    { type: 'element', tag: 'sup', attrs: { role: 'footnote' }, children: [{ type: 'text', text: '*' }] },
    { type: 'text', text: 'Ab 01.01.2027 gilt 750000 Euro.' },
  ] }] }];
  Object.assign(data.norms['§ 147a'], { source_annotations: annotations,
    source_annotations_text: '*Ab 01.01.2027 gilt 750000 Euro.', source_annotations_sha256: hash('*Ab 01.01.2027 gilt 750000 Euro.') });
  data.norms_by_index = { 0: { ...data.norms['§ 147a'], enbez: '§ 147a' } };
  t.mock.method(globalThis, 'fetch', async () => Response.json(data));
  const result = await loadStructuredNorms(law);
  for (const key of ['§ 147a', '@index:0']) {
    assert.equal(result[key].text_sha256, hash('(1) 500000 Euro.'));
    assert.deepEqual(result[key].source_annotations, annotations);
    assert.equal(result[key].source_annotations_text, '*Ab 01.01.2027 gilt 750000 Euro.');
    assert.equal(result[key].source_annotations_sha256, hash('*Ab 01.01.2027 gilt 750000 Euro.'));
  }
  const historical = act(law.id, [{ enbez: '§ 147a', text: '(1) 400000 Euro.' }]);
  await assert.rejects(loadStructuredNorms(historical));
});

test('annotation hashes, complete text and safe structure are verified independently and fail closed', async t => {
  const law = act('fed_bad_annotations', Array.from({length: 7}, (_, index) => ({ enbez: `§ ${index + 1}`, text: `Body ${index + 1}` })));
  const data: any = payload(law);
  for (const row of Object.values(data.norms) as any[]) Object.assign(row, {
    source_annotations: [{ type: 'text', text: 'Official note.' }], source_annotations_text: 'Official note.', source_annotations_sha256: hash('Official note.'),
  });
  data.norms['§ 1'].source_annotations_sha256 = hash('Other note.');
  data.norms['§ 2'].source_annotations[0].text = 'Other note.';
  data.norms['§ 3'].source_annotations = [{ type: 'element', tag: 'script', children: [] }];
  delete data.norms['§ 4'].source_annotations_text;
  data.norms['§ 5'].source_annotations = [{ type: 'element', tag: 'p', attrs: { onclick: 'unsafe' }, children: [{ type: 'text', text: 'Official note.' }] }];
  data.norms['§ 6'].text_sha256 = hash('A different body.');
  t.mock.method(globalThis, 'fetch', async () => Response.json(data));
  assert.deepEqual(Object.keys(await loadStructuredNorms(law)), ['§ 7']);
});


test('identical duplicate bodies cannot inherit annotations from a name-only record', async t => {
  const law = act('fed_duplicate_notes', [{ enbez: 'Anlage', text: 'Same body.' }, { enbez: 'Anlage', text: 'Same body.' }]);
  const data: any = payload(law);
  Object.assign(data.norms.Anlage, { source_annotations: [{ type: 'text', text: 'Only first annex.' }],
    source_annotations_text: 'Only first annex.', source_annotations_sha256: hash('Only first annex.') });
  data.norms_by_index = { 0: { ...data.norms.Anlage, enbez: 'Anlage' } };
  t.mock.method(globalThis, 'fetch', async () => Response.json(data));
  const result = await loadStructuredNorms(law);
  assert.equal(getStructuredNorm(result, law, law.norms![0])?.source_annotations_text, 'Only first annex.');
  assert.equal(getStructuredNorm(result, law, law.norms![1])?.source_annotations_text, undefined);
});


const archivedEdition = (overrides: Partial<KerfActMarkdown> = {}): KerfActMarkdown => ({
  act_id: 'fed_test', requested_at: '2026-07-16', resolved_at: '2026-07-16', exact: true, partial: false, complete: true,
  source_exact: true, state_sha256: 'a'.repeat(64), markdown: '## § 1 — Früher\n\nOld body.', ...overrides,
});
const archivedPayload = (edition: KerfActMarkdown) => ({ ...payload(act(edition.act_id, [{ enbez: '§ 1', text: 'Old body.' }])),
  requested_at: edition.requested_at, state_sha256: edition.state_sha256,
});

test('dated structures bind exact archive body and CAS while excluding current annotations', async t => {
  const edition = archivedEdition();
  const data: any = archivedPayload(edition);
  data.norms['§ 1'].source_annotations = [{ type: 'text', text: 'Current note' }];
  data.norms['§ 1'].source_annotations_text = 'Current note';
  data.norms['§ 1'].source_annotations_sha256 = hash('Current note');
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async input => {
    calls++;
    assert.match(String(input), /\/acts\/fed_test\/reader\?at=2026-07-16$/);
    return Response.json(data);
  });
  const first = loadArchivedStructuredNorms(edition), second = loadArchivedStructuredNorms(edition);
  assert.equal(first, second);
  const result = await first;
  assert.equal(result.act.norms![0].text, 'Old body.');
  assert.equal(result.act.norms![0].titel, 'Früher');
  assert.deepEqual(Object.keys(result.structures['§ 1']).sort(), ['blocks', 'text_sha256']);
  assert.equal(calls, 1);
});

test('dated structures reject date, CAS, body and act mismatches; failed fetches remain retryable', async t => {
  for (const override of [{ requested_at: '2026-07-29' }, { state_sha256: 'b'.repeat(64) }, { act_id: 'other_act' },
    { norms: { '§ 1': { text_sha256: hash('Other'), blocks: [{ type: 'text', text: 'Other' }] } } }]) {
    const edition = archivedEdition(); let calls = 0;
    const mocked = t.mock.method(globalThis, 'fetch', async () => {
      calls++;
      return Response.json({ ...archivedPayload(edition), ...(calls === 1 ? override : {}) });
    });
    await assert.rejects(loadArchivedStructuredNorms(edition));
    assert.ok((await loadArchivedStructuredNorms(edition)).structures['§ 1']);
    assert.equal(calls, 2);
    mocked.mock.restore();
  }
  const edition = archivedEdition(); let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => ++calls === 1 ? new Response('', {status:404}) : Response.json(archivedPayload(edition)));
  await assert.rejects(loadArchivedStructuredNorms(edition));
  assert.ok((await loadArchivedStructuredNorms(edition)).structures['§ 1']);
});

test('dated structure verification requires a complete unscoped edition with a valid CAS identity', async t => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => { calls++; throw new Error('Unexpected fetch'); });
  for (const override of [{ state_sha256: null }, { state_sha256: 'wrong' }, { partial: true }, { complete: false }, { norm: '§ 1' }, { requested_at: '../HEAD' }]) {
    await assert.rejects(loadArchivedStructuredNorms(archivedEdition(override)));
  }
  assert.equal(calls, 0);
});
