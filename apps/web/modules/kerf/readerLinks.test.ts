import assert from 'node:assert/strict';
import test from 'node:test';
import type { KerfAct, KerfStatutoryCitation } from './client';
// @ts-expect-error Native Node strip-types needs an explicit .ts suffix.
import { tokenizeLegalText, type ReaderLinkContext } from './readerLinks.ts';

const acts = [
  { id: 'fed_asylvfg_1992', jurabk: 'AsylVfG 1992', title: 'Asylgesetz' },
  { id: 'fed_aufenthg_2004', jurabk: 'AufenthG 2004', title: 'Aufenthaltsgesetz' },
  { id: 'fed_sgb_12', jurabk: 'SGB 12', title: 'Sozialgesetzbuch Zwölftes Buch' },
  { id: 'fed_sgb_9_2018', jurabk: 'SGB 9 2018', title: 'Sozialgesetzbuch Neuntes Buch' },
  { id: 'fed_bgb', jurabk: 'BGB', title: 'Bürgerliches Gesetzbuch' },
] as KerfAct[];

function citation(text: string, act: string, norm: string, extra = {}) {
  return {
    status: 'resolved', source_act: 'fed_asylvfg_1992', source_norm: '§ 3',
    citation_text: text, target_act: act, target_norm: norm,
    target_jurabk: acts.find((row) => row.id === act)?.jurabk,
    ...extra,
  } as KerfStatutoryCitation;
}

function parts(text: string, extra: Partial<ReaderLinkContext> = {}) {
  const output = tokenizeLegalText(text, { actId: 'fed_asylvfg_1992', acts, ...extra });
  assert.equal(output.map((part) => part.text).join(''), text);
  let offset = 0;
  for (const part of output) {
    assert.equal(part.start, offset);
    assert.equal(part.text, text.slice(part.start, part.end));
    assert.ok(part.end > part.start);
    offset = part.end;
  }
  assert.equal(offset, text.length);
  return output;
}

const ASYL_THREE = 'Die Zuerkennung des internationalen Schutzes richtet sich nach den Kapiteln III bis VI der Verordnung (EU) 2024/1347. Hinsichtlich der Anwendung von Artikel 14 Absatz 2 der Verordnung (EU) 2024/1347 ist eine besonders schwere Straftat im Sinne des Artikels 14 Absatz 1 Buchstabe e der Verordnung (EU) 2024/1347 anzunehmen, wenn die in §\u00a060 Absatz\u00a08 Nummer\u00a02 des Aufenthaltsgesetzes genannten Voraussetzungen vorliegen oder das Bundesamt nach §\u00a060 Absatz 8a oder 8b des Aufenthaltsgesetzes von der Anwendung des § 60 Absatz 1 des Aufenthaltsgesetzes abgesehen hat.';

test('AsylG section 3 yields separate lossless EU and German references without nested markup', () => {
  const citations = [
    citation('§ 60 Absatz 8 Nummer 2 des Aufenthaltsgesetzes', 'fed_aufenthg_2004', '§ 60'),
    citation('§ 60 Absatz 8a oder 8b des Aufenthaltsgesetzes', 'fed_aufenthg_2004', '§ 60'),
    citation('§ 60 Absatz 1 des Aufenthaltsgesetzes', 'fed_aufenthg_2004', '§ 60'),
  ];
  const links = parts(ASYL_THREE, { citations }).filter((part) => part.reference);
  assert.equal(links.length, 6);
  assert.deepEqual(links.slice(0, 3).map((part) => part.reference?.kind), ['external', 'external', 'external']);
  assert.equal(links[1].text, 'Artikel 14 Absatz 2 der Verordnung (EU) 2024/1347');
  assert.equal(links[2].text, 'Artikels 14 Absatz 1 Buchstabe e der Verordnung (EU) 2024/1347');
  assert.ok(links.slice(0, 3).every((part) => part.reference?.url === 'https://eur-lex.europa.eu/eli/reg/2024/1347/oj/deu'));
  assert.ok(links.slice(1, 3).every((part) => part.reference?.norm === 'Art. 14'));
  assert.ok(links.slice(3).every((part) => part.reference?.actId === 'fed_aufenthg_2004'));
});

test('explicit EU instrument overrides an old incorrectly resolved self edge', () => {
  const text = 'Artikels 14 Absatz 1 Buchstabe e der Verordnung (EU) 2024/1347';
  const links = parts(text, {
    norms: [{ enbez: 'Art. 14' }],
    citations: [citation('Artikels 14 Absatz 1 Buchstabe e', 'fed_asylvfg_1992', 'Art. 14')],
  }).filter((part) => part.reference);
  assert.equal(links.length, 1);
  assert.equal(links[0].reference?.kind, 'external');
});

test('old regulation numbering and directive numbering resolve to distinct official ELI types', () => {
  const links = parts('Art. 6 der Verordnung (EG) Nr. 1234/2007 und Artikel 2 der Richtlinie 2011/95/EU.').filter((part) => part.reference);
  assert.deepEqual(links.map((part) => part.reference?.url), [
    'https://eur-lex.europa.eu/eli/reg/2007/1234/oj/deu',
    'https://eur-lex.europa.eu/eli/dir/2011/95/oj/deu',
  ]);
});

test('repeated exact references preserve all whitespace and do not match section 110', () => {
  const links = parts('Siehe § 11. Dann §\u00a011; nicht § 110.', {
    citations: [citation('§ 11', 'fed_asylvfg_1992', '§ 11')],
  }).filter((part) => part.reference);
  assert.deepEqual(links.map((part) => part.text), ['§ 11', '§\u00a011']);
});

test('joint paragraph references get distinct targets without overlapping links', () => {
  const text = 'Die §§ 11 und 12 SGB XII gelten neben § 110.';
  const citations = ['§ 11', '§ 12'].map((norm) => citation('§§ 11 und 12 SGB XII', 'fed_sgb_12', norm));
  const links = parts(text, { citations }).filter((part) => part.reference);
  assert.deepEqual(links.map((part) => part.reference?.norm), ['§ 11', '§ 12']);
  assert.deepEqual(links.map((part) => part.text), ['§§ 11', '12 SGB XII']);
});

test('AGSG mixed section and paragraph list has separate targets and a balanced final alias', () => {
  const text = '§§ 1835 Abs. 1 und 1849 des Bürgerlichen Gesetzbuches (BGB)';
  const links = parts(text, { citations: ['§ 1835', '§ 1849'].map(norm => citation(text, 'fed_bgb', norm)) }).filter(part => part.reference);
  assert.deepEqual(links.map(part => [part.text, part.reference?.norm, part.reference?.pinpoint]), [
    ['§§ 1835 Abs. 1', '§ 1835', '§ 1835 Abs. 1'],
    ['1849 des Bürgerlichen Gesetzbuches (BGB)', '§ 1849', undefined],
  ]);
});

test('every member of a plural list keeps its own subdivision, including repeated markers', () => {
  for (const text of ['§§ 1 Abs. 2 und 3 Abs. 4 SGB XII', '§ 1 Abs. 2 und § 3 Abs. 4 SGB XII']) {
    const links = parts(text, { citations: ['§ 1', '§ 3'].map(norm => citation(text, 'fed_sgb_12', norm)) }).filter(part => part.reference);
    assert.deepEqual(links.map(part => [part.reference?.norm, part.reference?.pinpoint]), [
      ['§ 1', '§ 1 Abs. 2'], ['§ 3', '§ 3 Abs. 4'],
    ]);
  }
});

test('singular section retains Absatz lists, sentence abbreviations and double letters', () => {
  for (const suffix of ['Abs. 1 und 2', 'Absätze 1 und 2', 'Abs. 1 S. 2 Nr. 3 Buchstabe aa', 'Abs. 1 Satz 2 Doppelbuchstabe bb', 'Unterabsätze 1 und 2 Alternative 1', 'Abs. 1 Dreifachbuchstabe aaa']) {
    const text = `§ 11 ${suffix}`;
    const links = parts(text, { norms: [{enbez: '§ 11'}] }).filter(part => part.reference);
    assert.deepEqual(links.map(part => [part.text, part.reference?.pinpoint]), [[text, text]]);
  }
});

test('legacy truncated aliases include only the closing brackets opened inside the citation', () => {
  const phrase = '§ 11 des Bürgerlichen Gesetzbuches (BGB';
  const links = parts(`(${phrase})).`, { citations: [citation(phrase, 'fed_bgb', '§ 11')] }).filter(part => part.reference);
  assert.deepEqual(links.map(part => part.text), [`${phrase})`]);
});

test('short cross-act index entries never override a foreign suffix or unresolved longer citation', () => {
  const short = citation('§ 11', 'fed_sgb_12', '§ 11');
  for (const text of ['§ 11 OtherG', '§ 11 Abs. 2 OtherG', '§ 11 des fremden Gesetzes']) {
    assert.equal(parts(text, {citations: [short]}).filter(part => part.reference).length, 0);
  }
  const text = '§ 11, Sonderregelung';
  assert.equal(parts(text, {citations: [short, citation(text, 'fed_sgb_12', '§ 11', {status: 'unresolved'})]}).filter(part => part.reference).length, 0);
});

test('indexed targets must agree with the norm literally present in the source', () => {
  assert.equal(parts('§ 11', { citations: [citation('§ 11', 'fed_sgb_12', '§ 12')] }).filter(part => part.reference).length, 0);
});

test('repeated section numbers in one group retain all distinct written pinpoints', () => {
  const text = '§ 11 Abs. 2 und § 11 Abs. 3 SGB XII';
  const links = parts(text, {citations: [citation(text, 'fed_sgb_12', '§ 11')]}).filter(part => part.reference);
  assert.deepEqual(links.map(part => [part.text, part.reference?.pinpoint]), [
    ['§ 11 Abs. 2', '§ 11 Abs. 2'], ['§ 11 Abs. 3 SGB XII', '§ 11 Abs. 3'],
  ]);
});

test('a final section in an established plural group keeps its Absatz list', () => {
  const text = '§§ 23 und 24 Abs. 1 und 2 SGB XII';
  const links = parts(text, {citations: ['§ 23', '§ 24'].map(norm => citation(text, 'fed_sgb_12', norm))}).filter(part => part.reference);
  assert.deepEqual(links.map(part => [part.text, part.reference?.pinpoint]), [
    ['§§ 23', undefined], ['24 Abs. 1 und 2 SGB XII', '§ 24 Abs. 1 und 2'],
  ]);
});

test('a deeper subdivision after an Absatz list does not invent another section', () => {
  const text = '§§ 23 und 24 Abs. 1 und 2 Satz 3 SGB XII';
  const links = parts(text, {citations: ['§ 23', '§ 24'].map(norm => citation(text, 'fed_sgb_12', norm))}).filter(part => part.reference);
  assert.deepEqual(links.map(part => [part.text, part.reference?.pinpoint]), [
    ['§§ 23', undefined], ['24 Abs. 1 und 2 Satz 3 SGB XII', '§ 24 Abs. 1 und 2 Satz 3'],
  ]);
});

test('social book shorthand cannot override evidence that the target norm does not exist', () => {
  const text = '§ 9999 des Neunten Buches';
  const links = parts(text, {actId: 'fed_sgb_12', citations: [citation(text, 'fed_sgb_9_2018', '§ 9999', {
    source_act: 'fed_sgb_12', status: 'unresolved', unresolved_reason: 'target_norm_not_in_current_corpus',
  })]}).filter(part => part.reference);
  assert.equal(links.length, 0);
});

test('self fallback requires a current norm and suppresses unknown explicit foreign laws', () => {
  const links = parts('§ 11 gilt. § 999 gilt nicht. § 11 UnknownG. Artikel 14 der unbekannten Verordnung.', {
    norms: [{ enbez: '§ 11' }, { enbez: 'Art. 14' }],
  }).filter((part) => part.reference);
  assert.deepEqual(links.map((part) => part.text), ['§ 11']);
});

test('unresolved citation evidence blocks a seemingly valid self reference', () => {
  const links = parts('§ 11 des fremden Gesetzes.', {
    norms: [{ enbez: '§ 11' }],
    citations: [citation('§ 11 des fremden Gesetzes', 'fed_asylvfg_1992', '§ 11', { status: 'unresolved' })],
  }).filter((part) => part.reference);
  assert.equal(links.length, 0);
});

test('short social book reference corrects old self-citation only inside social-code context', () => {
  const text = 'Das Persönliche Budget nach § 29 des Neunten Buches.';
  const extra = {
    norms: [{ enbez: '§ 29' }],
    citations: [citation('§ 29', 'fed_sgb_12', '§ 29', { source_act: 'fed_sgb_12' })],
  };
  const links = parts(text, { ...extra, actId: 'fed_sgb_12' }).filter((part) => part.reference);
  assert.equal(links.length, 1);
  assert.equal(links[0].reference?.actId, 'fed_sgb_9_2018');
  assert.equal(links[0].reference?.norm, '§ 29');
  assert.equal(parts(text, { norms: extra.norms }).filter((part) => part.reference).length, 0);
});

test('HTML-like input remains plain source text, never HTML or URL payload', () => {
  const text = '<gco-l-u>§ 11</gco-l-u><img src=x onerror=alert(1)> \"javascript:alert(1)\"';
  const output = parts(text, { norms: [{ enbez: '§ 11' }] });
  assert.ok(output.every((part) => !('html' in part)));
  assert.ok(output.every((part) => !part.reference?.url?.startsWith('javascript:')));
  assert.ok(output.some((part) => part.text.includes('<img')));
});

test('ambiguous indexed citations and citations from another act stay unlinked', () => {
  const text = '§ 11 OtherG.';
  assert.equal(parts(text, { citations: [
    citation(text.slice(0, -1), 'fed_sgb_12', '§ 11'),
    citation(text.slice(0, -1), 'fed_sgb_9_2018', '§ 11'),
  ] }).filter((part) => part.reference).length, 0);
  assert.equal(parts('§ 11', { citations: [
    citation('§ 11', 'fed_sgb_12', '§ 11', { source_act: 'fed_sgb_12' }),
  ] }).filter((part) => part.reference).length, 0);
});

test('empty and unicode source strings round-trip deterministically', () => {
  for (const text of ['', '„Wörtlich“\n  § 11\t§ 110\r\n𐐀', '§ 11a, §§ 11 bis 12.']) {
    const context = { norms: [{ enbez: '§ 11' }, { enbez: '§ 11a' }, { enbez: '§ 12' }] };
    assert.deepEqual(parts(text, context), parts(text, context));
  }
});

test('large immutable norm snapshots are indexed once across many independent text flows', () => {
  let reads = 0;
  const norms = Array.from({ length: 2551 }, (_, i) => ({ get enbez() { reads++; return `§ ${i + 1}`; } }));
  const context = { acts: [...acts], norms, citations: [citation('§ 11', 'fed_sgb_12', '§ 11')] };
  const expected = parts('§ 11 und § 2551.', context);
  assert.equal(expected.filter(part => part.reference).length, 2);
  for (let i = 0; i < 100; i++) assert.deepEqual(parts('§ 11 und § 2551.', { ...context }), expected);
  assert.ok(reads <= norms.length * 2, `read ${reads} norm labels for ${norms.length} source norms`);
});

test('replacement snapshots and appended metadata invalidate lookup caches without regex state leaking', () => {
  const norms = [{ enbez: '§ 11' }];
  const context = { acts: [...acts], norms, citations: [citation('§ 11', 'fed_sgb_12', '§ 11')] };
  assert.equal(parts('§ 11 § 12', context).filter(part => part.reference).length, 1);
  norms.push({ enbez: '§ 12' });
  assert.equal(parts('§ 11 § 12', context).filter(part => part.reference).length, 2);
  context.citations.push(citation('§ 12', 'fed_sgb_9_2018', '§ 12'));
  assert.deepEqual(parts('§ 11 § 12 § 11', context).filter(part => part.reference).map(part => part.reference?.actId),
    ['fed_sgb_12', 'fed_sgb_9_2018', 'fed_sgb_12']);
  assert.deepEqual(parts('§ 11 § 12 § 11', context), parts('§ 11 § 12 § 11', context));
  assert.equal(parts('§ 11', { ...context, acts: context.acts.filter(act => act.id !== 'fed_sgb_12'), norms: [] }).filter(part => part.reference).length, 0);
  assert.equal(parts('§ 12', { norms: [{ enbez: '§ 13' }] }).filter(part => part.reference).length, 0);
});

test('a full date after bis is prose rather than a section-range endpoint', () => {
  for (const text of ['nach § 176 bis einschließlich 31. Dezember 2012', 'nach § 176 bis 31.12.2012']) {
    const refs = parts(text, { norms: [{enbez:'§ 176'}, {enbez:'§ 31'}] }).filter(p=>p.reference);
    assert.deepEqual(refs.map(p=>p.reference?.norm), ['§ 176']);
    assert.equal(refs[0].text,'§ 176');
  }
});
