import assert from 'node:assert/strict';
import test from 'node:test';
import type { KerfAct, KerfStatutoryCitation } from './client';
// @ts-expect-error Native Node strip-types needs an explicit .ts suffix.
import { tokenizeLegalText, type ReaderLinkContext } from './readerLinks.ts';

const acts = [
  { id: 'own', jurabk: 'OwnG', title: 'Ausgangsgesetz' },
  { id: 'fed_bgb', jurabk: 'BGB', title: 'Bürgerliches Gesetzbuch' },
  { id: 'fed_zpo', jurabk: 'ZPO', title: 'Zivilprozessordnung' },
] as KerfAct[];

test('mixed local and foreign singular citations keep independent indexed destinations', () => {
  const text = 'kein anrechenbares Einkommen nach § 82 oder § 11 des Zweiten Buches darstellen';
  const sgbActs = [{ id: 'fed_sgb_12', jurabk: 'SGB 12' }, { id: 'fed_sgb_2', jurabk: 'SGB 2' }] as KerfAct[];
  const context = { actId: 'fed_sgb_12', acts: sgbActs, norms: [{ enbez: '§ 82' }], citations: [
    { source_act: 'fed_sgb_12', source_norm: '§ 28', citation_text: '§ 82', status: 'resolved', target_act: 'fed_sgb_12', target_norm: '§ 82' },
    { source_act: 'fed_sgb_12', source_norm: '§ 28', citation_text: '§ 11 des Zweiten Buches', status: 'resolved', target_act: 'fed_sgb_2', target_norm: '§ 11' },
  ] as KerfStatutoryCitation[] };
  const result = tokenizeLegalText(text, context);
  assert.equal(result.map(part => part.text).join(''), text);
  assert.deepEqual(result.filter(part => part.reference).map(part => [part.reference?.norm, part.reference?.actId]), [
    ['§ 82', 'fed_sgb_12'], ['§ 11', 'fed_sgb_2'],
  ]);
  // No indexed proof: an ambiguous preceding singular member must not be
  // confidently redirected to the trailing book. Plural scope stays shared.
  const unproved = tokenizeLegalText(text, { ...context, citations: [] });
  assert.equal(unproved.find(part => part.text === '§ 82')?.reference?.actId, undefined);
  const plural = tokenizeLegalText('§§ 11 und 12 des Zweiten Buches', { ...context, citations: [] });
  assert.deepEqual(plural.filter(part => part.reference).map(part => part.reference?.actId), ['fed_sgb_2', 'fed_sgb_2']);
  // Existing corpus rows repeat the whole mixed phrase for both targets;
  // those rows are not independent evidence for the earlier member.
  const legacy = tokenizeLegalText(text, { ...context, citations: ['§ 82', '§ 11'].map(target_norm => ({
    source_act: 'fed_sgb_12', source_norm: '§ 28', citation_text: '§ 82 oder § 11 des Zweiten Buches',
    status: 'resolved', target_act: 'fed_sgb_2', target_norm,
  } as KerfStatutoryCitation)) });
  assert.deepEqual(legacy.filter(part => part.reference).map(part => part.reference?.norm), ['§ 11']);
});

function row(citation_text: string, target_act: string, target_norm: string, extra = {}): KerfStatutoryCitation {
  return { source_act: 'own', source_norm: '§ 10', status: 'resolved', citation_text,
    target_act, target_norm, target_jurabk: acts.find(act => act.id === target_act)?.jurabk,
    ...extra } as KerfStatutoryCitation;
}
function links(text: string, extra: Partial<ReaderLinkContext> = {}) {
  const parts = tokenizeLegalText(text, { actId: 'own', acts,
    norms: ['§ 1', '§ 2', '§ 3', '§ 11', '§ 12', '§ 13'].map(enbez => ({ enbez })), ...extra });
  assert.equal(parts.map(part => part.text).join(''), text);
  let offset = 0;
  for (const part of parts) {
    assert.equal(part.start, offset);
    assert.equal(part.text, text.slice(part.start, part.end));
    assert.ok(part.end > part.start);
    offset = part.end;
  }
  assert.equal(offset, text.length);
  return parts.filter(part => part.reference);
}

// GII XML reader fixture: TKG § 21, official directive citation with a two-letter subdivision.
test('TKG article citation retains its full double-letter pinpoint and directive destination', () => {
  const text = 'Artikel 61 Absatz 2 Unterabsatz 2 Buchstabe ii der Richtlinie (EU) 2018/1972';
  const result = links(text);
  assert.deepEqual(result.map(part => [part.text, part.reference?.norm, part.reference?.pinpoint, part.reference?.url]), [[
    text, 'Art. 61', 'Art. 61 Absatz 2 Unterabsatz 2 Buchstabe ii', 'https://eur-lex.europa.eu/eli/dir/2018/1972/oj/deu',
  ]]);
});

// GII XML reader fixture: AMG § 96; c/ca and iaa/ib are distinct real subdivision labels.
test('AMG mixed letter lists remain attached to their EU article', () => {
  const pinpoint = 'Artikel 8 Absatz 3 Unterabsatz 1 Buchstabe c, ca Satz 1, Buchstabe d, e, h bis iaa oder Buchstabe ib';
  const text = `${pinpoint} der Richtlinie 2001/83/EG`;
  const result = links(text);
  assert.deepEqual(result.map(part => [part.text, part.reference?.norm, part.reference?.url]), [[
    text, 'Art. 8', 'https://eur-lex.europa.eu/eli/dir/2001/83/oj/deu',
  ]]);
  assert.equal(result[0].reference?.pinpoint, pinpoint.replace(/^Artikel /u, 'Art. '));
});

test('ordinary prose after numeric subdivisions is outside citation spans', () => {
  for (const suffix of [' und die Vorschriften', ' oder andere Regeln', ' bis dahin', ', insbesondere dann', ' und Die Regeln']) {
    assert.deepEqual(links(`§ 1 Absatz 1${suffix}`).map(part => part.text), ['§ 1 Absatz 1']);
  }
});

test('ordinary prose after a letter subdivision is not another letter identifier', () => {
  for (const suffix of [' und die Vorschriften', ' oder der Ausschuss', ', das Gericht', ' bis zur Entscheidung']) {
    assert.deepEqual(links(`§ 1 Nummer 2 Buchstabe a${suffix}`).map(part => part.text), ['§ 1 Nummer 2 Buchstabe a']);
  }
});

test('same section number in different explicit acts keeps two separate destinations', () => {
  const result = links('§ 11 BGB und § 11 ZPO; § 110; § 11a.', { citations: [
    row('§ 11 BGB', 'fed_bgb', '§ 11'), row('§ 11 ZPO', 'fed_zpo', '§ 11'), row('§ 11', 'fed_bgb', '§ 11'),
  ] });
  assert.deepEqual(result.map(part => [part.text, part.reference?.actId, part.reference?.norm]), [
    ['§ 11 BGB', 'fed_bgb', '§ 11'], ['§ 11 ZPO', 'fed_zpo', '§ 11'],
  ]);
});

test('long unresolved occurrences suppress short resolved rows only at that occurrence', () => {
  const result = links('§ 11; § 11 UnknownG; § 11.', { citations: [
    row('§ 11', 'fed_bgb', '§ 11'), row('§ 11 UnknownG', 'fed_bgb', '§ 11', { status: 'unresolved' }),
  ] });
  assert.deepEqual(result.map(part => [part.start, part.reference?.actId]), [[0, 'fed_bgb'], [21, 'fed_bgb']]);
});

test('a range links the written endpoints separately without swallowing its connector', () => {
  const text = '§§ 1 bis einschließlich 3 BGB';
  const result = links(text, { citations: ['§ 1', '§ 2', '§ 3'].map(norm => row(text, 'fed_bgb', norm)) });
  assert.deepEqual(result.map(part => [part.text, part.reference?.norm]), [['§§ 1', '§ 1'], ['3 BGB', '§ 3']]);
});

test('dash ranges keep the same written endpoint targets as bis ranges', () => {
  for (const dash of ['–', ' - ']) {
    const text = `§§ 1${dash}3 BGB`;
    const result = links(text, { citations: ['§ 1', '§ 2', '§ 3'].map(norm => row(text, 'fed_bgb', norm)) });
    assert.deepEqual(result.map(part => [part.text, part.reference?.norm]), [['§§ 1', '§ 1'], ['3 BGB', '§ 3']]);
  }
});

test('sowie list members each navigate to the section they name', () => {
  const text = '§§ 11, 12 sowie 13 BGB';
  const result = links(text, { citations: ['§ 11', '§ 12', '§ 13'].map(norm => row(text, 'fed_bgb', norm)) });
  assert.deepEqual(result.map(part => [part.text, part.reference?.norm]), [['§§ 11', '§ 11'], ['12', '§ 12'], ['13 BGB', '§ 13']]);
});

test('BGB section 636 gives each section its own Absatz 2', () => {
  const text = 'Außer in den Fällen der §§ 281 Abs. 2 und 323 Abs. 2 bedarf es der Fristsetzung auch dann nicht';
  const phrase = '§§ 281 Abs. 2 und 323 Abs. 2';
  const result = links(text, { citations: ['§ 281', '§ 323'].map(norm => row(phrase, 'fed_bgb', norm)) });
  assert.deepEqual(result.map(part => [part.text, part.reference?.norm, part.reference?.pinpoint]), [
    ['§§ 281 Abs. 2', '§ 281', '§ 281 Abs. 2'], ['323 Abs. 2', '§ 323', '§ 323 Abs. 2'],
  ]);
});

// AdVermiG § 4 Abs. 4: older indexes retained the first short spelling for § 2,
// while the § 2a edge retained the entire later compound occurrence.
test('AdVermiG compound keeps both exact member destinations with complete or legacy indexed evidence', () => {
  for (const connector of [', ', ' und ', ' oder ', ' sowie ']) {
    const phrase = `§ 2 Absatz 3${connector}§ 2a Absatz 4 Nummer 2`;
    const text = `Die Adoptionsvermittlungsstelle (${phrase}) informiert die zentrale Adoptionsstelle.`;
    for (const complete of [false, true]) {
      const citations = [row('§ 2 Absatz 3', 'own', '§ 2'), row(phrase, 'own', '§ 2a')];
      if (complete) citations.push(row(phrase, 'own', '§ 2'));
      const result = links(text, { citations });
      assert.deepEqual(result.map(part => [part.text, part.reference?.actId, part.reference?.norm, part.reference?.pinpoint]), [
        ['§ 2 Absatz 3', 'own', '§ 2', '§ 2 Absatz 3'],
        ['§ 2a Absatz 4 Nummer 2', 'own', '§ 2a', '§ 2a Absatz 4 Nummer 2'],
      ], `${connector}: complete=${complete}`);
    }
  }
});

test('contained group evidence cannot revive a member with unknown or conflicting act scope', () => {
  const phrase = '§ 2 Absatz 3, § 2a Absatz 4 Nummer 2';
  for (const longer of [
    row(phrase, 'own', '§ 2a', { status: 'unresolved' }),
    row(phrase, 'fed_bgb', '§ 2a'),
    row(phrase, 'own', '§ 99'),
  ]) {
    const result = links(`(${phrase})`, { citations: [row('§ 2 Absatz 3', 'own', '§ 2'), longer] });
    assert.ok(!result.some(part => part.reference?.norm === '§ 2'));
  }
  const result = links(`${phrase} BGB`, { citations: [
    row('§ 2 Absatz 3', 'own', '§ 2'), row(`${phrase} BGB`, 'fed_bgb', '§ 2a'),
  ] });
  assert.deepEqual(result.map(part => [part.text, part.reference?.actId]), [['§ 2a Absatz 4 Nummer 2 BGB', 'fed_bgb']]);
});

test('a longer ambiguous group continues to block its shorter member', () => {
  const phrase = '§ 2 Absatz 3, § 2a Absatz 4 Nummer 2';
  const result = links(phrase, { citations: [
    row('§ 2 Absatz 3', 'own', '§ 2'), row(phrase, 'own', '§ 2a'), row(phrase, 'fed_bgb', '§ 2a'),
  ] });
  assert.equal(result.length, 0);
});

test('AdVermiG mixed current-section Absatz scope does not invent a second law target', () => {
  const text = 'wenn sie die Voraussetzungen des § 3 und des Absatzes 1 Satz 1 Nummer 2 nicht mehr erfüllt.';
  const result = links(text, { citations: [row('§ 3', 'own', '§ 3')] });
  assert.deepEqual(result.map(part => [part.text, part.reference?.norm, part.reference?.pinpoint]), [['§ 3', '§ 3', undefined]]);
});


test('legacy member evidence preserves only its own pinpoint among repeated section heads', () => {
  const phrase = '§ 2 Absatz 3, § 2 Absatz 4, § 2a Absatz 5';
  const result = links(phrase, { citations: [row('§ 2 Absatz 3', 'own', '§ 2'), row(phrase, 'own', '§ 2a')] });
  assert.deepEqual(result.map(part => [part.text, part.reference?.pinpoint]), [
    ['§ 2 Absatz 3', '§ 2 Absatz 3'], ['§ 2a Absatz 5', '§ 2a Absatz 5'],
  ]);
});

test('legacy evidence for a later compound member remains independently linkable', () => {
  const phrase = '§ 2 Absatz 3 und § 2a Absatz 4';
  const result = links(phrase, { citations: [row(phrase, 'own', '§ 2'), row('§ 2a Absatz 4', 'own', '§ 2a')] });
  assert.deepEqual(result.map(part => [part.text, part.reference?.norm]), [
    ['§ 2 Absatz 3', '§ 2'], ['§ 2a Absatz 4', '§ 2a'],
  ]);
});

test('AO source note does not turn abbreviated EGAO references into AO self links', () => {
  const text = '(+++ § 147a: Zur Anwendung vgl. Art. 97 § 1 Abs. 10 u. §§ 22 u. 37 EGAO +++)';
  const result = links(text, { norms: ['§ 147a', 'Art. 97', '§ 1', '§ 22', '§ 37'].map(enbez => ({ enbez })) });
  assert.deepEqual(result.map(part => [part.text, part.reference?.norm]), [['§ 147a', '§ 147a']]);
});

test('foreign act scope covers adjacent mixed Art and section designations without crossing prose', () => {
  for (const connector of [' ', ', ', ' und ', ' u. ']) {
    const text = `Art. 97${connector}§ 1 Abs. 10 u. §§ 22 u. 37 UnknownG`;
    assert.equal(links(text, { norms: ['Art. 97', '§ 1', '§ 22', '§ 37'].map(enbez => ({ enbez })) }).length, 0);
  }
  const result = links('Art. 97 gilt weiterhin. § 1 Abs. 10 u. § 2 BGB', {
    norms: [{ enbez: 'Art. 97' }, { enbez: '§ 1' }, { enbez: '§ 2' }],
    citations: ['§ 1', '§ 2'].map(norm => row('§ 1 Abs. 10 u. § 2 BGB', 'fed_bgb', norm)),
  });
  assert.deepEqual(result.map(part => [part.text, part.reference?.actId, part.reference?.norm]), [
    ['Art. 97', 'own', 'Art. 97'], ['§ 1 Abs. 10', 'fed_bgb', '§ 1'], ['§ 2 BGB', 'fed_bgb', '§ 2'],
  ]);
});

test('abbreviated und remains a pinpoint list for singular sections and independent norms for plural sections', () => {
  assert.deepEqual(links('§ 1 Abs. 2 u. 3').map(part => [part.text, part.reference?.pinpoint]), [['§ 1 Abs. 2 u. 3', '§ 1 Abs. 2 u. 3']]);
  assert.deepEqual(links('§§ 1 u. 2').map(part => [part.text, part.reference?.norm]), [['§§ 1', '§ 1'], ['2', '§ 2']]);
});
